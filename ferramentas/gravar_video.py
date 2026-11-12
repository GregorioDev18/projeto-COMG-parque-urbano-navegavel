"""Grava o vídeo de apresentação a partir do tour automático (src/tour.js).

Uso (com o `npm run dev` rodando em outra janela):
    python3 ferramentas/gravar_video.py [url] [saida.mp4] [quadros por segundo] [só estes instantes, ex.: 5,20,60]

Abre o Chromium sem janela, espera os 5 modelos carregarem e, para cada quadro, chama window.tour.irPara(t)
e tira uma captura pelo Chrome DevTools Protocol. Depois o ffmpeg junta as capturas em MP4 (H.264).
Como cada quadro é montado para um instante exato, o vídeo sai com a velocidade certa mesmo que a máquina
leve vários segundos para desenhar cada um (o WebGL aqui roda em software, sem placa de vídeo).
Precisa de: chromium, ffmpeg e o pacote Python websocket-client.
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import websocket

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173/?tour=1"
SAIDA = sys.argv[2] if len(sys.argv) > 2 else "docs/video.mp4"
FPS = int(sys.argv[3]) if len(sys.argv) > 3 else 24
SO_INSTANTES = [float(x) for x in sys.argv[4].split(",")] if len(sys.argv) > 4 else None
PORTA = 9333


def main():
    perfil = tempfile.mkdtemp(prefix="gravar-")
    chrome = subprocess.Popen([
        "chromium", "--headless=new", "--no-sandbox", f"--remote-debugging-port={PORTA}",
        f"--user-data-dir={perfil}", "--window-size=1280,720", "--hide-scrollbars",
        "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", URL,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                abas = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORTA}/json"))
                aba = next(a for a in abas if a.get("type") == "page")
                break
            except Exception:
                time.sleep(0.5)
        ws = websocket.create_connection(aba["webSocketDebuggerUrl"], timeout=120, suppress_origin=True)
        ids = iter(range(1, 10**9))

        def cdp(metodo, **params):
            i = next(ids)
            ws.send(json.dumps({"id": i, "method": metodo, "params": params}))
            while True:
                r = json.loads(ws.recv())
                if r.get("id") == i:
                    if "error" in r:
                        raise RuntimeError(r["error"])
                    return r.get("result", {})

        def js(expr):
            return cdp("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)["result"].get("value")

        # área visível exata de 1280 x 720 (sem janela, o --window-size inclui a barra do navegador)
        cdp("Emulation.setDeviceMetricsOverride", width=1280, height=720, deviceScaleFactor=1, mobile=False)
        js("dispatchEvent(new Event('resize'))")
        while not js("window.tour !== undefined && window.modelosCarregados >= 5"):
            time.sleep(0.5)
        time.sleep(4)  # as texturas terminam de chegar depois dos modelos
        duracao = js("window.tour.duracao")
        instantes = SO_INSTANTES or [i / FPS for i in range(int(duracao * FPS))]
        pasta = tempfile.mkdtemp(prefix="quadros-")
        inicio = time.time()
        for n, t in enumerate(instantes):
            js(f"window.tour.irPara({t})")
            img = cdp("Page.captureScreenshot", format="jpeg", quality=92)["data"]
            open(os.path.join(pasta, f"q{n:05d}.jpg"), "wb").write(base64.b64decode(img))
            if n % 48 == 0:
                print(f"{n}/{len(instantes)} quadros, {time.time() - inicio:.0f} s", flush=True)
        ws.close()
        if SO_INSTANTES:
            print("capturas em", pasta)
            return
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i",
                        os.path.join(pasta, "q%05d.jpg"), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-crf", "24", "-preset", "slow", "-movflags", "+faststart", SAIDA], check=True)
        shutil.rmtree(pasta)
        print("vídeo:", SAIDA, os.path.getsize(SAIDA) // 1024, "KB")
    finally:
        chrome.terminate()
        shutil.rmtree(perfil, ignore_errors=True)


if __name__ == "__main__":
    main()
