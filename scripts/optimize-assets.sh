#!/bin/bash
set -e

echo "=== Optimizing public/images ==="
cd public/images
for f in *.png; do
  if [ -f "$f" ]; then
    base="${f%.png}"
    echo "Converting $f -> ${base}.webp"
    ffmpeg -y -i "$f" -c:v libwebp -quality 85 "${base}.webp" -loglevel error
    # Also optimize the png using convert
    convert "$f" -strip -quality 90 "${f}.tmp"
    if [ -f "${f}.tmp" ] && [ -s "${f}.tmp" ]; then
      mv "${f}.tmp" "$f"
    fi
  fi
done

cd ../../src/assets/images
echo "=== Optimizing src/assets/images ==="
for f in *.jpg *.jpeg; do
  if [ -f "$f" ]; then
    base="${f%.*}"
    echo "Converting $f -> ${base}.webp"
    ffmpeg -y -i "$f" -c:v libwebp -quality 84 "${base}.webp" -loglevel error
    convert "$f" -strip -quality 85 "${f}.tmp"
    if [ -f "${f}.tmp" ] && [ -s "${f}.tmp" ]; then
      mv "${f}.tmp" "$f"
    fi
  fi
done

cd ../../../public/landing-pages/meng-to-sketchbook
echo "=== Optimizing meng-to-sketchbook assets ==="
for f in *.png; do
  if [ -f "$f" ]; then
    base="${f%.png}"
    ffmpeg -y -i "$f" -c:v libwebp -quality 85 "${base}.webp" -loglevel error
  fi
done
for f in *.jpg *.jpeg; do
  if [ -f "$f" ]; then
    base="${f%.*}"
    ffmpeg -y -i "$f" -c:v libwebp -quality 85 "${base}.webp" -loglevel error
  fi
done

echo "Asset optimization complete!"
