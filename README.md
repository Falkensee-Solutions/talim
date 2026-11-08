# Talim · Fatiha

Çocuklar için deneysel dinleme ve ezber çalışması.

- Ayetleri seçerek dinleme ve sürekli tekrar.
- Tam, ayet ayet, orta adımlar ve kelime kelime çalışma.
- Hoca bir kez okur; öğrenci 1, 3, 5 veya 7 kez sessiz tekrar eder.
- Tekrarlar arasında 5 saniye hazırlık süresi; öğrenci turunda görsel takip.
- Sağ üstteki görünüm ayarları: Türkçe okunuş, takip işareti ve kaynak/lisans bilgisi.
- Alt açıklama ve footer gösterilmez; oynatma durumu yalnızca ekran okuyuculara duyurulur.
- Ayet numaraları yalnızca yandaki seçim düğmelerinde gösterilir; Eûzü başlangıcı elif (ا) ile işaretlenir.
- Ayet alanları düz köşelidir; solda seçim çizgisi yoktur. Alanlar arasında ortalanmış, %90 genişliğinde ince bir alt çizgi bulunur; son alanın altında çizgi gösterilmez.
- Arapça metin yerel Talim Quran yazı tipiyle gösterilir: harekeler ve şedde kırmızı, durak işaretleri mor. Harf birleşimleri ve üst üste gelen harekeler yazı tipinin Kur’an dizgisiyle yerleştirilir; metin ve ses eşleşme konumları değiştirilmez.

### Arapça yazı tipi

`TalimQuran.ttf`, [Amiri Quran Colored 1.003](https://github.com/aliftype/amiri/releases/tag/1.003) türevidir. SIL Open Font License 1.1 metni `Amiri-OFL.txt` içinde dağıtılır. Aile adı Talim Quran olarak değiştirilmiştir; CPAL paletindeki 0–2 renkleri `#B42332`, 3. renk `#7D3C98` yapılmıştır. U+06DC küçük sîn/durak işaretinin COLR katmanı da 3. renge taşınmıştır. Glif şekilleri, GPOS hareke yerleşimleri ve GSUB harf birleşimleri korunmuştur. Yazı tipi siteyle birlikte sunulur; harici bir yazı tipi servisine istek yapılmaz.

**Deneme sürümüdür.** Takip işareti yaklaşık zamanlamalar kullanır; harf/tecvid
uygunluğu veya çocuğun okuması otomatik değerlendirilmez. Mikrofon kullanılmaz.
Öğretmen kontrolü önerilir. Öğrencinin sesi ve öğrenme ilerlemesi kaydedilmez.

Med ve şedde işaretleri, mevcut görsel dağılıma küçük oransal ipuçları ekler;
kelime sınırları ve özel son-kelime hizalaması değişmez. Kırmızı işaret düz üst
kenarlı bir trapezdir. [Kaynaklar, kapsam ve zamanlama sınırları](TAJWEED-TIMING.md).

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
