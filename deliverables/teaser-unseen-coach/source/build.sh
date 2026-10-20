set -e
G="eq=contrast=1.08:saturation=0.82,colorbalance=rs=0.04:gs=0.01:bs=-0.04,vignette=PI/5"
ffmpeg -v error -y \
 -ss 1.0 -t 2.5 -i 5686.mp4 -ss 5.6 -t 2.5 -i 23288.mp4 -ss 1.0 -t 2.4 -i 47462.mp4 -ss 0.3 -t 2.1 -i hd_52094.mp4 -loop 1 -t 1.8 -i endcard.png \
 -filter_complex "\
[0]crop=ih*9/16:ih:iw*0.42-ih*9/32:0,scale=1080:1920,eq=brightness=-0.10,$G,fps=30,setpts=PTS-STARTPTS,format=yuv420p[a];\
[1]crop=ih*9/16:ih:iw*0.46-ih*9/32:0,scale=1080:1920,$G,fps=30,setpts=PTS-STARTPTS,format=yuv420p[b];\
[2]crop=ih*9/16:ih:iw*0.36-ih*9/32:0,scale=1080:1920,$G,fps=30,setpts=PTS-STARTPTS,format=yuv420p[c];\
[3]crop=ih*9/16:ih:iw*0.47-ih*9/32:0,scale=1080:1920,$G,fps=30,setpts=PTS-STARTPTS,format=yuv420p[d];\
[4]scale=1080:1920,fps=30,format=yuv420p[e];\
[a][b]xfade=transition=fade:duration=0.3:offset=2.2[ab];[ab][c]xfade=transition=fade:duration=0.3:offset=4.4[abc];\
[abc][d]xfade=transition=fade:duration=0.3:offset=6.5[abcd];[abcd][e]xfade=transition=fadeblack:duration=0.5:offset=8.3,trim=0:10,setpts=PTS-STARTPTS[v]" \
 -map "[v]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p base.mp4
ffmpeg -v error -y -i base.mp4 -i sub1.png -i sub2.png -i sub3.png -i sub4.png -f lavfi -t 10 -i anullsrc=r=48000:cl=stereo -filter_complex "\
[0][1]overlay=enable='between(t,0.2,2.3)'[x1];[x1][2]overlay=enable='between(t,2.5,4.5)'[x2];[x2][3]overlay=enable='between(t,4.7,6.6)'[x3];[x3][4]overlay=enable='between(t,6.8,8.4)'[v]" \
 -map "[v]" -map 5:a -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest teaser_subtitled.mp4
ffmpeg -v error -y -i base.mp4 -f lavfi -t 10 -i anullsrc=r=48000:cl=stereo -map 0:v -map 1:a -c:v copy -c:a aac -shortest teaser_clean.mp4
for t in 1.2 3.6 5.6 7.6 9.5; do ffmpeg -v error -y -ss $t -i teaser_subtitled.mp4 -frames:v 1 -vf scale=270:-1 c_$t.jpg; done
ffmpeg -v error -y -i c_1.2.jpg -i c_3.6.jpg -i c_5.6.jpg -i c_7.6.jpg -i c_9.5.jpg -filter_complex hstack=5 check.jpg
