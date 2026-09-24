#!/bin/sh
# ---------------------------------------------------------------------------
# firebase-tools 15+ Firestore/Storage emülatörleri için JDK 21 veya üstü ister
# ("firebase-tools no longer supports Java version before 21").
#
# Bu sarmalayıcı, yeterli bir JDK bulup JAVA_HOME/PATH'i ayarlar ve komutu
# çalıştırır. Böylece emülatör komutları makineye özel yol bilmeden çalışır.
#
# Kullanım:  sh scripts/with-jdk.sh firebase emulators:start ...
# ---------------------------------------------------------------------------
set -e

java_major() {
  # "openjdk version "21.0.5" ..." → 21
  "$1" -version 2>&1 | head -1 | sed -E 's/.*version "([0-9]+).*/\1/'
}

# Zaten yeterli bir java PATH'te mi?
if command -v java >/dev/null 2>&1; then
  if [ "$(java_major java)" -ge 21 ] 2>/dev/null; then
    exec "$@"
  fi
fi

# Bilinen kurulum yerlerini tara (macOS Homebrew, macOS sistem, Linux).
for candidate in \
  "$JAVA_HOME" \
  /opt/homebrew/opt/openjdk \
  /opt/homebrew/opt/openjdk@25 \
  /opt/homebrew/opt/openjdk@21 \
  /usr/local/opt/openjdk@21 \
  /Library/Java/JavaVirtualMachines/*/Contents/Home \
  /usr/lib/jvm/*
do
  [ -x "$candidate/bin/java" ] || continue
  if [ "$(java_major "$candidate/bin/java")" -ge 21 ] 2>/dev/null; then
    JAVA_HOME="$candidate"
    PATH="$candidate/bin:$PATH"
    export JAVA_HOME PATH
    exec "$@"
  fi
done

echo "HATA: Firebase emülatörleri için JDK 21+ gerekli, bulunamadı." >&2
echo "  macOS:  brew install openjdk@21" >&2
echo "  Ubuntu: sudo apt install openjdk-21-jdk" >&2
exit 1
