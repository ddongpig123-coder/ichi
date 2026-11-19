#!/usr/bin/env python3
# usage: python3 mkreel.py spec.json   (run in v1 dir)
import json, subprocess, sys
spec = json.load(open(sys.argv[1])); name = spec["name"]; B = spec.get("clipdir", "../batch2")
VENC = "-c:v libx264 -crf 18 -pix_fmt yuv420p -r 30".split(); AENC = "-c:a aac -b:a 160k -ar 44100 -ac 2".split()
caps = []; segs = []
def run(a): subprocess.run(a, check=True)
for i, s in enumerate(spec["segs"]):
    out = f"{name}_{i}.mp4"; segs.append(out)
    if s["type"] == "clip":
        names = []
        for j, c in enumerate(s["caps"]):
            n = f"{name}_{i}_{j}"; names.append(n); caps.append({"name": n, "style": "k", "jp": c["jp"], "kr": c.get("kr", "")})
        s["_names"] = names
    elif s["type"] == "app":
        n = f"{name}_{i}_c"; caps.append({"name": n, "style": "c", "jp": s["jp"], "kr": s.get("kr", ""), "note": s.get("note", "")}); s["_cap"] = n
json.dump(caps, open(f"{name}_caps.json", "w"), ensure_ascii=False)
run(["node", "capgen.cjs", f"{name}_caps.json"])
for i, s in enumerate(spec["segs"]):
    out = segs[i]
    if s["type"] == "clip":
        t = s["t"]; ins = ["-ss", str(s["ss"]), "-t", str(t), "-i", f"{B}/{s['src']}.mp4"]
        fc = "[0:v]scale=1080:1920:flags=lanczos,setsar=1,fps=30[v0];"; last = "v0"
        for j, c in enumerate(s["caps"]):
            ins += ["-i", s["_names"][j] + ".png"]
            a, b = c.get("from", 0), c.get("to", t)
            fc += f"[{last}][{j+1}:v]overlay=0:0:enable='between(t,{a},{b})'[v{j+1}];"; last = f"v{j+1}"
        ln = "loudnorm=I=-15:TP=-1.5," if s.get("speech", True) else "volume=1.4,"
        fc += f"[0:a]{ln}afade=t=in:d=0.1,afade=t=out:st={t-0.2:.2f}:d=0.2[a]"
        run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", fc, "-map", f"[{last}]", "-map", "[a]"] + VENC + AENC + ["-t", str(t), out])
    elif s["type"] == "app":
        t = s["t"]; z = s.get("zoom", 0.02); yy = s.get("yfrac", 0.0)
        fc = (f"[0:v]scale=w='(trunc(881*(1+{z}*t)/2)+1)*2':h='(trunc(1500*(1+{z}*t)/2)+1)*2':eval=frame,crop=881:1500:(iw-881)/2:(ih-1500)*{yy},setsar=1,format=rgba[v];"
              "[2:v]format=gray[m];[v][m]alphamerge[vm];[1:v][vm]overlay=99:400[b];[b][3:v]overlay=0:0,fps=30,format=yuv420p[vo]")
        run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", s["img"], "-i", "bg.png", "-i", "mask.png", "-i", s["_cap"] + ".png", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
             "-filter_complex", fc, "-map", "[vo]", "-map", "4:a"] + VENC + AENC + ["-t", str(t), out])
    elif s["type"] == "file":
        segs[i] = s["file"]
open(f"{name}_list.txt", "w").write("".join(f"file '{x}'\n" for x in segs))
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{name}_list.txt", "-c", "copy", f"{name}.mp4"])
run(["ffmpeg", "-v", "error", "-y", "-i", f"{name}.mp4", "-vf", "fps=1/1.2,scale=180:-1,tile=8x2", "-frames:v", "1", f"{name}_sheet.png"])
print(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{name}.mp4"], capture_output=True, text=True).stdout.strip())
