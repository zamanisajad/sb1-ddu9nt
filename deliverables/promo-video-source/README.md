# منبع ویدیوی معرفی
video.html = انیمیشن (تابع render(t))، shot.js = ساخت فریم‌ها با Playwright.
فایل‌های تصویر/فونت از coach-helper: landing/public/l/*.webp، assets/fonts/Coach*.ttf، assets/images/logo-mark.png
ساخت: node shot.js full ← سپس ffmpeg -framerate 30 -i frames/f%04d.jpg -c:v libx264 -crf 18 -pix_fmt yuv420p out.mp4
