set -e
cd "$(dirname "$0")"
G="eq=contrast=1.06:saturation=0.9"
V(){ echo "crop=ih*9/16:ih:iw*$1-ih*9/32:0,scale=1080:1920,$G,fps=30,setsar=1,format=yuv420p"; }
ffmpeg -v error -y \
 -ss 2 -t 6.8 -i 38501.mp4 -ss 0.5 -t 6.2 -i 4588.mp4 -ss 8 -t 3.5 -i 750.mp4 -ss 0 -t 3.0 -i 43477.mp4 \
 -ss 4 -t 3.5 -i 747.mp4 -ss 3 -t 3.0 -i 35981.mp4 -ss 5 -t 3.5 -i 6652.mp4 -ss 0.5 -t 3.5 -i 13733.mp4 \
 -loop 1 -t 8 -i pdfcard.png -loop 1 -t 5 -i endcard.png \
 -filter_complex "\
[0]$(V 0.55),eq=brightness=-0.12,setpts=PTS-STARTPTS[a];[1]$(V 0.45),setpts=PTS-STARTPTS[b];[2]$(V 0.5),setpts=PTS-STARTPTS[c];\
[3]$(V 0.5),setpts=PTS-STARTPTS[d];[4]$(V 0.5),setpts=PTS-STARTPTS[e];[5]$(V 0.5),setpts=PTS-STARTPTS[f];\
[6]$(V 0.5),setpts=PTS-STARTPTS[g];[7]$(V 0.5),setpts=PTS-STARTPTS[h];\
[8]scale=1188:2112,zoompan=z='1+0.0006*in':d=1:s=1080x1920:fps=30,setsar=1,format=yuv420p[i];\
[9]scale=1080:1920,fps=30,setsar=1,format=yuv420p[j];\
[a][b][c][d][e][f][g][h][i][j]concat=n=10:v=1:a=0[v]" -map "[v]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -r 30 base.mp4
O="[0][h1]overlay=enable='between(t,0.3,3.55)'[o1];[o1][h2]overlay=enable='between(t,3.55,6.8)'[o2]"
T=(0.3 3.6 6.9 10.0 13.1 16.6 19.6 23.1 26.1 29.6 33.2 37.1); E=(3.5 6.7 9.9 12.9 16.4 19.4 22.9 25.9 29.4 32.9 36.9 40.9)
IN="-i hook1.png -i hook2.png"; F="[1]copy[h1];[2]copy[h2];$O"; last=o2
for k in $(seq 1 12); do IN="$IN -i sub$k.png"; idx=$((k+2)); F="$F;[$last][$idx]overlay=enable='between(t,${T[$((k-1))]},${E[$((k-1))]})'[s$k]"; last=s$k; done
ffmpeg -v error -y -i base.mp4 $IN -f lavfi -t 46 -i anullsrc=r=48000:cl=stereo -filter_complex "$F" -map "[$last]" -map 15:a \
 -c:v libx264 -crf 19 -preset medium -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart ../reel-nojavan-subtitled.mp4
ffmpeg -v error -y -i base.mp4 -i hook1.png -i hook2.png -f lavfi -t 46 -i anullsrc=r=48000:cl=stereo -filter_complex "[1]copy[h1];[2]copy[h2];$O" -map "[o2]" -map 3:a \
 -c:v libx264 -crf 19 -preset medium -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart ../reel-nojavan-clean.mp4
for t in 2 5 8 11 15 18 21 24 27 31 35 39 43; do ffmpeg -v error -y -ss $t -i ../reel-nojavan-subtitled.mp4 -frames:v 1 -vf scale=216:-1 c_$t.jpg; done
ffmpeg -v error -y $(for t in 2 5 8 11 15 18 21; do echo -n "-i c_$t.jpg "; done) -filter_complex hstack=7 r1.jpg
ffmpeg -v error -y $(for t in 24 27 31 35 39 43 2; do echo -n "-i c_$t.jpg "; done) -filter_complex hstack=7 r2.jpg
ffmpeg -v error -y -i r1.jpg -i r2.jpg -filter_complex vstack=2 check.jpg
