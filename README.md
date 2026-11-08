# Talim · Fatiha

Çocuklar için deneysel dinleme ve ezber çalışması.

- Ayetleri seçerek dinleme ve sürekli tekrar.
- Tam, ayet ayet, orta adımlar ve kelime kelime çalışma.
- Hoca bir kez okur; öğrenci 1, 3, 5 veya 7 kez sessiz tekrar eder.
- Ezber ekranındaki İnce ayarlar: tekrar sayısı (varsayılan 3), tekrar arası (1–5 saniye, varsayılan 3) ve mevcut kayıt için Hafız 1. Üçü de yan yana seçim düğmeleriyle gösterilir.
- Tekrar sırasında görsel takip; hoca/öğrenci ikonları ve açıklama metinleri gösterilmez. Normal dinlemedeki hazırlık süresi de varsayılan 3 saniyedir.
- Sağ üstteki görünüm ayarları: Türkçe okunuş, takip işareti ve kaynak/lisans bilgisi.
- Alt açıklama ve footer gösterilmez; oynatma durumu yalnızca ekran okuyuculara duyurulur.
- Ayet numaraları yalnızca yandaki seçim düğmelerinde gösterilir; Eûzü başlangıcı elif (ا) ile işaretlenir.
- Ayet alanları düz köşelidir; solda seçim çizgisi yoktur. Alanlar arasında ortalanmış, %90 genişliğinde ince bir alt çizgi bulunur; son alanın altında çizgi gösterilmez.
- Arapça metin Açık Kuran’daki Shaikh Hamdullah Mushaf yazı tipiyle gösterilir: harfler ve noktaları siyah, harekeler ve şedde kırmızı, durak işaretleri mor. Metin ve ses eşleşme konumları değiştirilmez.

### Arapça yazı tipi

`TalimQuran.ttf`, [Açık Kuran](https://acikkuran.com/1) tarafından kullanılan **Shaikh Hamdullah Mushaf** (Muhammet Abay, 2011) yazı tipinin Talim Hamdullah adlı renkli görünüm sürümüdür. Proje sahibi kullanım ve siteyle dağıtım iznini doğrulamıştır; fontun genel bir açık lisansa sahip olduğu iddia edilmez. Kaynak, özgün dosyanın SHA-256 özeti ve telif bilgisi `Hamdullah-NOTICE.txt` içinde korunur ve Ayarlar’dan açılır.

Glif şekilleri, karakter eşleştirmeleri, GPOS hareke yerleşimleri ve GSUB harf birleşimleri değiştirilmez. Eklenen COLR/CPAL katmanları yalnızca harekeleri (bağlama göre kullanılan alternatifleriyle birlikte) `#B42332`, durakları `#7D3C98` yapar. Harflerin kendi noktaları siyah kalır. Yazı tipi yerel dosyadan sunulur; harici yazı tipi servisine istek yapılmaz.

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
