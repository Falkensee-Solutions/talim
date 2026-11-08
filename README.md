# Talim · Fatiha

Çocuklar için deneysel dinleme ve ezber çalışması.

- Ayetleri seçerek dinleme ve sürekli tekrar.
- Tam, ayet ayet, orta adımlar ve kelime kelime çalışma.
- Hoca bir kez okur; öğrenci 1, 3, 5 veya 7 kez sessiz tekrar eder.
- Tekrarlar arasında 5 saniye hazırlık süresi; öğrenci turunda görsel takip.
- Görünüm ayarları: Türkçe okunuş ve takip işareti.

**Deneme sürümüdür.** Takip işareti yaklaşık zamanlamalar kullanır; harf/tecvid
uygunluğu veya çocuğun okuması otomatik değerlendirilmez. Mikrofon kullanılmaz.
Öğretmen kontrolü önerilir. Öğrencinin sesi ve öğrenme ilerlemesi kaydedilmez.

## Yerel kullanım

Node.js 20 veya üzeri gerekir; ek npm bağımlılığı yoktur.

```bash
npm start
npm test
npm run build
```

Yerel adres: `http://127.0.0.1:4173/`. Statik web çıktısı `dist/` klasörüne yazılır.
Yalnızca uygulamanın gereken dosyaları ve hazır zamanlamalar çıktıya alınır;
model çağrısı veya yeni ses işleme yapılmaz.

GitHub Pages, GitHub Actions iş akışıyla yayımlanır. Pages sürümü salt okunurdur:
Node API sunucusu, anahtarlar, sanal ortam ve yerel ASR/diagnostik yanıtları
web sitesine dahil edilmez. Ses, statik yayında tarayıcı içi Blob üzerinden çalınır;
böylece sunucunun byte-range desteğinden bağımsız olarak seçilen ayete geçilebilir.
Elle eşleştirme aracı korunmuştur ama görünmezdir;
statik yayından içerik dosyaları sunucuya kaydedilemez.

## Kaynaklar ve kullanım hakları

Arapça metin ve Türkçe okunuş: [Açık Kuran](https://acikkuran.com/fatiha-suresi.md),
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.tr).
Kaynak atfı arayüzde korunur; ticari kullanım ve yeniden dağıtımda lisans koşullarına
uyulmalıdır. Bu depo, metin veya ses için genel bir MIT lisansı vermez.

Ses kaydı, kayıt sahibinin açık yayımlama onayıyla bu test sürümüne dahil edilmiştir.
Kaydın okuyucusu hakkında ayrıca doğrulanmamış bir isim/kimlik iddiası eklenmemiştir.
