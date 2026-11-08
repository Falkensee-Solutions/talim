# Tecvid kaynakları ve küçük görsel zamanlama düzeltmesi

Bu değişiklik ses dosyasını, kelime başlangıç/bitişlerini veya düzeltilmiş son üç
kelimenin grup aralıklarını değiştirmez. Amaç, zaten iyi çalışan yaklaşık işaretin
kelime içi hareketine küçük bir oransal ipucu eklemektir; yeni bir ses hizalaması,
telaffuz değerlendirmesi veya tecvid doğruluk onayı değildir.

## Kaynak incelemesinin kapsamı

[Tecvid dersleri dizininde](https://tecvid.org/tecvid-dersleri/) listelenen
16 numaralı dersin ve iki giriş yazısının erişilebilir metinleri incelendi.
Gömülü video anlatımları ve resim içindeki tablolar bu metin incelemesiyle
çözümlenmiş sayılmadı. Derslerin tam metinleri, görselleri ve videoları uygulamaya
kopyalanmadı; aşağıdaki notlar uygulama kapsamındaki kısa teknik çıkarımlardır.

| Konu ve kaynak | Zamanlama açısından sonuç |
|---|---|
| [Tecvidin hükmü](https://tecvid.org/tecvid-dersleri-01-tecvid-nedir-tecvidin-hukmu/), [temeller](https://tecvid.org/tecvid-ilmi-nedir/), [Kur’an tarihi](https://tecvid.org/kuran-i-kerimin-tarifi-fazileti-ve-tarihcesi/) | Kural ve eğitim çerçevesi; her harf için sabit saniye tablosu değildir. |
| [Mahreçler](https://tecvid.org/2-ders-mahrecler-harflerin-cikis-yerleri/), [sıfatlar](https://tecvid.org/3-ders-sifatlar/), [ince/kalın](https://tecvid.org/13-ders-ince-ve-kalin-uygulamalari/), [hemze/elif](https://tecvid.org/14-ders-hemze-ile-elif-arasindaki-fark/) | Sesin niteliği ve harf ayrımı; kalın harflere otomatik fazladan süre verilmez. Her harekesiz harf med harfi sayılmaz. |
| [Sakin nûn/tenvin](https://tecvid.org/4-ders-nunu-sakin-cezimli-nun-ve-tenvin/), [sakin mîm](https://tecvid.org/5-ders-sakin-mimin-cezimli-mimin-kurallari/), [diğer idgamlar](https://tecvid.org/6-ders-diger-idgamlar/) | Sonraki harf ve birleşme bağlamı önemlidir. Şedde iki ünsüzün birleşmesini temsil eder; bütün şeddelere sabit bir saniye veya otomatik gunne eklenmez. |
| [Med](https://tecvid.org/7-ders-med-uzatma/) | Tabiî med 2 harekedir. Yazılı kalıcı sükûn/şeddeyle ilgili lâzım med için 6 hareke ipucu vardır. Bunlar okuyuş temposuna bağlı oranlardır; dersin saniye örneği evrensel bir ölçü değildir. |
| [Mukattaa](https://tecvid.org/8-ders-hurufu-mukattaanin-okunusu/), [zamir hâ](https://tecvid.org/9-ders-zamir-he-nin-uzatilmasi/) | Özel harf adları ve bağlamsal uzatmalar; Fatiha’daki her hâ veya çıplak harfe bu kurallar uygulanmaz. |
| [Lafzatullah](https://tecvid.org/10-ders-lafzatullah/), [râ](https://tecvid.org/11-ders-ranin-okunusu/) | Öncelikle ince/kalın söyleyiş hükümleri; tek başına bir süre çarpanı değildir. |
| [Vakıf](https://tecvid.org/18-ders-vakif-ve-isaretleri/) | Durma ve geçme aynı değildir; ârız medde 2/4/6 seçenekleri bulunur. Kayıtta seçilen vecih metinden kesin belirlenmediği için otomatik 4 veya 6 atanmaz. |
| [Sekte](https://tecvid.org/19-ders-sekte/), [tilavet secdesi](https://tecvid.org/28-ders-tilavet-secdesi/) | Fatiha’ya rastgele yeni sessizlik veya secde süresi eklenmez. Mevcut sesin sessizlikleri korunur. Ayrı tekrar araları varsayılan 1,5 saniyedir; ezber ekranının İnce ayarlar bölümünde 0,5; 1; 1,5; 2; 3; 4 veya 5 saniye seçilebilir. |

**Belirsizlik:** Sakin mîm dersinin gövdesinde iki hareke, alt notunda yaklaşık üç
hareke ifadeleri bulunuyor. Bu fark seçilip kayda zorla uygulanmadı. Gunne,
vasıl/vakıf ve kıraat tercihleri genel bir harf eşleştirme çözümü olarak sunulmuyor.

## Uygulanan oransal ipucu

Kurallar [tajweed-timing.mjs](tajweed-timing.mjs) içinde yerel ve deterministiktir;
çalışırken siteye, başka modele veya bir ses servisine veri gönderilmez.

- Haraka grubu için başlangıç ağırlığı 1.
- Açık uygun hareke + bare elif/vâv/yâ veya küçük elif varsa tabiî med ipucu 2.
- Aynı kelimede açık medden sonra yazılı şedde/sükûn varsa uzun med ipucu 6.
- Şedde için ek ünsüzü temsil eden +1 görsel ağırlık. Bu, bütün şeddelerin
  belirli hareke veya saniye uzunluğunda olduğu iddiası değildir.
- Tek başına med işaretinin türü belirsizse ek süre seçilmez. Lîn, son hâ,
  izhar, kalınlık ve vakıf vecihleri rastgele uzatılmaya çevrilmez.

Eski eşit grup dağılımının **%85’i korunur**, kural ağırlıkları **%15** oranında
katılır. Her iç sınır ayrıca eski yerinden kelimenin sesli süresinin **en fazla
%2’si** kadar kaydırılır. Oranlar kelime içinde normalize edilir; başlangıç ve
bitiş aynı kalır. Sessizlik hâlâ hesaptan çıkarılır. Bu kayıtta ölçülen en büyük
görsel sınır değişimi yaklaşık **0,041 saniyedir**; bu sabit bir harf süresi değildir.

Özel `groupRanges` varsa bu ipucu tamamen atlanır. Bu nedenle daha önce düzeltilen
`وَلَا` ve `الضَّٓالّ۪ينَ` dahil son üç kelimenin özel aralıkları ve son nûn için
belirtilmiş görsel kapanış tahmini aynen korunur. Ham zaman dosyaları değiştirilmez.
Harf grupları ve metin de silinmez veya yeniden yazılmaz.

## Bağlı kelimelerde işaret

[word-preview.mjs](word-preview.mjs), aynı ayette sonraki kelimenin başlangıç
hareke grubunda şedde veya cezim varsa, en fazla 0,3 saniyelik aday zamanlama
boşluğunda işareti görünür tutar. Ölçülmüş sessizlikle kesilen geçişler ve ayet
sınırları birleştirilmez. Bu eşik bir telaffuz hükmü değil, uzun duraklamaları
köprülememek için görsel bir korumadır. Aynı satırda işaret iki kelime arasındaki
boşlukta ilerler; satır değişiminde çapraz hareket çizilmez.

Bağlı okumada artikelin yazılı vasıl elifi ayrı bir görsel adım olmaz; başlangıç
cezimi sonraki harekeli grupla birlikte taranır. Seslendirilen elif (örneğin
`اَنْعَمْتَ`) atlanmaz. Kelimeye bağımsız başlayan dinleme/ezber tekrarları ilk
orijinal gruptan başlar. Şeddeli harf atlanmaz; özel `groupRanges` ve kayıtlı
kelime/harf zamanları değiştirilmez. Bu yalnızca yaklaşık işaret hareketidir,
yeni ses hizalaması değildir.

Regresyon testleri şedde/cezim geçişini, vasıl ile seslendirilen elif ayrımını,
sessizlik/ayet/uzun boşluk korumalarını, bağımsız tekrar başlangıcını ve özel
akustik aralıkların korunmasını kapsar.

## İşaret ve kontroller

Kırmızı işaret artık sivri uç yerine **trapezdir**: genişlik 34 px, yükseklik 16 px;
üst düz kenar toplam genişliğin yarısı (17 px), alt kenar 34 px. Konumu ve rengi
korunur; “Oku göster” ayarı yine geçerlidir.

Testler doğal med/şedde ipuçlarını, uygun olmayan vâv örneğini, sınırların sıralı
ve en fazla %2 kaymış olmasını, sessizlik dışlamasını ve ölçülmüş son kelime
aralıklarının değişmemesini kontrol eder. Bu testler pedagojik veya tecvid
sertifikasyonu değildir; uygulama öğretmen kontrolüne açık yaklaşık bir araçtır.
