"""Cut the vertical short (1080x1920) for the read page (room-read) from vertical material, kept tall and large.

    node promo/shoot_read.mjs teardown-out/read-shots                  # phone-width screenshots of the read page
    ~/.venvs/chatterbox/bin/python promo/tts.py promo/narration-read-vertical.json
    ~/.venvs/chatterbox/bin/python promo/make_vertical_read.py promo/narration-read-vertical.json

A copy of make_vertical.py's headline, credit, subtitle and audio (same font, sizes, BGM ducking and loudnorm), with a
different picture area: the paper band on top keeps the headline and credit, and the picture fills the rest of the
screen, 1080 x 1360 from y = 560. Subtitles sit over the picture in the account's usual style (56 px white with a black
outline, bottom edge at y = 1245, above the zone the apps cover); over the end card they go on the paper below it,
as in the other shorts; over the page's own screens ("scroll", "phone") they go dark on a paper plate so the page's
text does not clash with them. A segment's "sub_y" instead puts its subtitles dark on the paper with their top at that y
(leave the band free with a "scroll" segment's "top").

Segment kinds ("kind"), each "dur" seconds long:
- "frames": an image sequence ("pattern" with %03d, "first", "last") stretched over dur, scaled to 1080 wide and cut
  to 1360 tall from "y" (rows of the 1080x1920 scaled frame).
- "pan": a still ("still") scaled to 1360 tall, a 1080-wide window moving from "x" [start, end] (0..1 of the free width).
- "scroll": a tall image ("image", scaled to "scale" x 1080 wide), a window from "top" (default 560) to the bottom edge,
  moving from "y" [start, end] (px of the scaled image), eased.
- "phone": an image sequence of phone screenshots (1080x1920) shown in a phone outline, 1300 tall, centred.
- "card": the end card (the hub screenshot framed as in make_vertical.py), subtitles below it.

Outputs teardown-out/<name>-vertical.mp4 and teardown-out/<name>-vertical-cover.jpg (a second argument renames them).
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torchaudio.functional as AF
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "teardown-out"
W, H, FPS, SR = 1080, 1920, 30, 48000
BG = (238, 241, 243)   # シリーズ共通の地（クールグレー）
INK = (31, 36, 39)
FONT = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
FONT_SUB = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
CX = 504  # text centre: the right 192 px are covered by the apps' buttons
MEDIA_Y, MEDIA_H = 560, 1360  # picture area under the headline, to the bottom edge
CREDIT_Y = 520
SUB_BOTTOM, SUB_PX = 1245, 56
CARD = {"crop": (1100, 720, 250, 90), "y": 690}  # end card framing of make_vertical.py
PHONE_H, PHONE_R, BEZEL = 1300, 44, 14


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def text_png(path: Path, lines: list[str], px: int, font_path: str, y0: int, fill, stroke=0, stroke_fill=None,
             line_h: float = 1.3, anchor_bottom: bool = False) -> None:
    font = ImageFont.truetype(font_path, px)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    step = int(px * line_h)
    y = y0 - step * len(lines) if anchor_bottom else y0
    for line in lines:
        d.text((CX - font.getlength(line) / 2, y), line, font=font, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
        y += step
    img.save(path)


def plate_png(path: Path, lines: list[str], px: int, bottom: int) -> None:
    """Dark subtitle on a paper plate, for segments that show the page itself (its own text would clash with outlines)."""
    font = ImageFont.truetype(FONT_SUB, px)
    step, pad = int(px * 1.3), 22
    width = max(font.getlength(line) for line in lines)
    top = bottom - step * len(lines)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((CX - width / 2 - pad, top - pad, CX + width / 2 + pad, bottom + pad - (step - px)),
                        radius=18, fill=BG + (242,), outline=(213, 220, 224, 255), width=2)
    for i, line in enumerate(lines):
        d.text((CX - font.getlength(line) / 2, top + i * step), line, font=font, fill=INK)
    img.save(path)


def phone_parts(tmp: Path) -> tuple[Path, Path, int, int, int]:
    """The phone outline (full-frame RGBA) and the rounded mask of the screen; returns them and the screen box."""
    pw = round(PHONE_H * W / H)
    x, y = CX - pw // 2, MEDIA_Y + (MEDIA_H - PHONE_H) // 2
    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((x - BEZEL, y - BEZEL, x + pw + BEZEL, y + PHONE_H + BEZEL),
                                            radius=PHONE_R + BEZEL, fill=INK + (255,))
    mask = Image.new("L", (pw, PHONE_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pw - 1, PHONE_H - 1), radius=PHONE_R, fill=255)
    fp, mp = tmp / "phone-frame.png", tmp / "phone-mask.png"
    frame.save(fp)
    mask.save(mp)
    return fp, mp, pw, x, y


def bg(dur: float) -> str:
    return f"color=c=0x{bytes(BG).hex()}:s={W}x{H}:r={FPS}:d={dur}[bg];"


def encode(inputs: list[str], fc: str, out: Path, dur: float) -> None:
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", "[v]", "-r", str(FPS), "-t", f"{dur}",
         "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(out)])


def seq_input(seg: dict, dur: float) -> list[str]:
    n = int(seg["last"]) - int(seg["first"]) + 1
    return ["-framerate", f"{n / dur:.6f}", "-start_number", str(seg["first"]), "-i", str(ROOT / seg["pattern"])]


def segment_clip(seg: dict, tmp: Path, i: int) -> tuple[Path, float]:
    out, dur, kind = tmp / f"seg{i}.mp4", float(seg["dur"]), seg["kind"]
    ease = f"(3*pow(min(t/{dur},1),2)-2*pow(min(t/{dur},1),3))"
    if kind == "frames":
        fc = bg(dur) + (f"[0:v]fps={FPS},scale={W}:{H}:flags=lanczos,crop={W}:{MEDIA_H}:0:{seg.get('y', 0)}[m];"
                        f"[bg][m]overlay=0:{MEDIA_Y}:shortest=0:eof_action=repeat[v]")
        encode(seq_input(seg, dur), fc, out, dur)
    elif kind == "pan":
        x0, x1 = seg["x"]
        free = f"(iw-{W})"
        fc = bg(dur) + (f"[0:v]scale=-2:{MEDIA_H}:flags=lanczos,crop={W}:{MEDIA_H}:'{free}*({x0}+({x1}-{x0})*{ease})':0[m];"
                        f"[bg][m]overlay=0:{MEDIA_Y}[v]")
        encode(["-loop", "1", "-framerate", str(FPS), "-t", f"{dur}", "-i", str(ROOT / seg["still"])], fc, out, dur)
    elif kind == "scroll":
        y0, y1 = seg["y"]
        top = int(seg.get("top", MEDIA_Y))
        sw = round(W * float(seg.get("scale", 1.0)) / 2) * 2
        fc = bg(dur) + (f"[0:v]scale={sw}:-2:flags=lanczos,crop={sw}:{H - top}:0:'{y0}+({y1}-{y0})*{ease}'[m];"
                        f"[bg][m]overlay={CX - sw // 2}:{top}[v]")
        encode(["-loop", "1", "-framerate", str(FPS), "-t", f"{dur}", "-i", str(ROOT / seg["image"])], fc, out, dur)
    elif kind == "phone":
        fp, mp, pw, x, y = phone_parts(tmp)
        fc = bg(dur) + (f"[0:v]fps={FPS},scale={pw}:{PHONE_H}:flags=lanczos,format=rgba[s];[2:v]format=gray[mk];"
                        f"[s][mk]alphamerge[sm];[bg][1:v]overlay=0:0[b1];"
                        f"[b1][sm]overlay={x}:{y}:shortest=0:eof_action=repeat[v]")
        encode(seq_input(seg, dur) + ["-loop", "1", "-i", str(fp), "-loop", "1", "-i", str(mp)], fc, out, dur)
    elif kind == "card":
        cw, ch, cx, cy = CARD["crop"]
        fc = bg(dur) + f"[0:v]scale=1600:900,crop={cw}:{ch}:{cx}:{cy},scale={W}:-2[m];[bg][m]overlay=0:{CARD['y']}[v]"
        encode(["-loop", "1", "-t", f"{dur}", "-i", str(ROOT / seg["still"])], fc, out, dur)
    else:
        raise ValueError(f"unknown segment kind: {kind}")
    return out, dur


def narration(report: dict, total: float, tmp: Path) -> Path:
    track = np.zeros(int(total * SR) + SR, dtype=np.float32)
    for line in report["lines"]:
        wav, sr = sf.read(line["wav"], dtype="float32")
        if wav.ndim > 1:
            wav = wav.mean(axis=1)
        wav = AF.resample(torch.from_numpy(wav), sr, SR).numpy()
        s = int(line["t"] * SR)
        track[s:s + len(wav)] += wav[: len(track) - s]
    track *= 0.7 / (float(np.abs(track).max()) or 1.0)
    path = tmp / "narration.wav"
    sf.write(path, track[: int(total * SR)], SR)
    return path


def seg_at(spec: dict, t: float) -> dict:
    acc = 0.0
    for seg in spec["segments"]:
        acc += float(seg["dur"])
        if t < acc:
            return seg
    return spec["segments"][-1]


def main() -> int:
    script = Path(sys.argv[1]).resolve()
    spec = json.loads(script.read_text())
    name = spec.get("name", "read")
    out_name = sys.argv[2] if len(sys.argv) > 2 else f"{name}-vertical"
    stem = script.stem[len("narration"):]
    report = json.loads((OUT / f"narration{stem}" / "lines.json").read_text())
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        clips = [segment_clip(seg, tmp, i) for i, seg in enumerate(spec["segments"])]
        total = sum(d for _, d in clips)
        (tmp / "list.txt").write_text("".join(f"file '{p}'\n" for p, _ in clips))
        body = tmp / "body.mp4"
        run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(tmp / "list.txt"), "-c", "copy", str(body)])

        head = tmp / "head.png"
        text_png(head, spec["headline"], 76, FONT, 310, INK)
        credit = tmp / "credit.png"
        text_png(credit, [spec["credit"]], 24, FONT_SUB, CREDIT_Y, (79, 90, 96))
        card_sub_top = CARD["y"] + round(W * CARD["crop"][1] / CARD["crop"][0]) + 28
        subs = []
        for i, (line, rep) in enumerate(zip(spec["lines"], report["lines"])):
            p = tmp / f"sub{i}.png"
            rows = line["sub"]
            start = rep["t"] + rep.get("speech_start", 0.0)
            seg = seg_at(spec, start)
            if seg["kind"] == "card":
                text_png(p, rows, SUB_PX - 4, FONT_SUB, card_sub_top, INK, line_h=1.3)
            elif "sub_y" in seg:
                text_png(p, rows, SUB_PX - 4, FONT_SUB, int(seg["sub_y"]), INK, line_h=1.3)
            elif seg["kind"] in ("scroll", "phone"):
                plate_png(p, rows, SUB_PX - 4, SUB_BOTTOM)
            else:
                text_png(p, rows, SUB_PX, FONT_SUB, SUB_BOTTOM, (255, 255, 255), stroke=5,
                         stroke_fill=(0, 0, 0), line_h=1.25, anchor_bottom=True)
            end = min(rep["t"] + (rep.get("speech_end") or rep["dur"]) + 0.25, total)
            subs.append((p, start, end))
        narr = narration(report, total, tmp)

        out = OUT / f"{out_name}.mp4"
        args = ["ffmpeg", "-v", "error", "-y", "-i", str(body), "-stream_loop", "-1", "-i", str(ROOT / "promo/bgm" / spec["bgm"]),
                "-i", str(narr), "-loop", "1", "-i", str(head), "-loop", "1", "-i", str(credit)]
        for p, _, _ in subs:
            args += ["-loop", "1", "-i", str(p)]
        v = "[0:v][3:v]overlay=0:0:shortest=1[h];[h][4:v]overlay=0:0:shortest=1[v0]"
        for i, (_, s, e) in enumerate(subs):
            v += f";[v{i}][{5 + i}:v]overlay=0:0:shortest=1:enable='between(t,{s:.2f},{e:.2f})'[v{i + 1}]"
        gain = float(spec.get("bgm_gain_db", -15))
        a = (f"[1:a]volume={gain}dB,afade=t=in:d=0.5,afade=t=out:st={total - 1.5:.2f}:d=1.5,aresample={SR},atrim=0:{total}[m];"
             "[2:a]asplit=2[n1][n2];[m][n1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];"
             "[duck][n2]amix=inputs=2:weights='1 1.6':normalize=0,loudnorm=I=-13:TP=-1.5:LRA=11[a]")
        args += ["-filter_complex", v + ";" + a, "-map", f"[v{len(subs)}]", "-map", "[a]", "-r", str(FPS),
                 "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-pix_fmt", "yuv420p", "-maxrate", "3M", "-bufsize", "6M",
                 "-c:a", "aac", "-b:a", "160k", "-ar", str(SR), "-movflags", "+faststart", "-t", f"{total:.2f}", str(out)]
        run(args)
        cover = OUT / f"{out_name}-cover.jpg"
        run(["ffmpeg", "-v", "error", "-y", "-ss", "1.2", "-i", str(out), "-frames:v", "1", "-q:v", "2", str(cover)])
    print(f"→ {out} ({total:.2f} s)\n→ {cover}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
