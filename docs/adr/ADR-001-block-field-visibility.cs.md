---
title: ADR-001 - Blok ukazuje výchozí sadu svých polí a zbytek jen při editaci
description: Český překlad ADR-001 pro lidské čtenáře. Zdrojem pravdy je anglický originál ADR-001-block-field-visibility.md; při rozporu platí on a AI asistenti čtou jen jeho.
category: adr
ai_load: never
status: draft
language: cs
translation_of: ADR-001-block-field-visibility.md
created: 2026-09-26
related:
  - docs/issues/003-address-block.md
  - src/BlockDocument/
---

# ADR-001: Blok ukazuje výchozí sadu svých polí a zbytek jen při editaci

> Toto je český překlad pro lidské čtenáře. **Zdrojem pravdy je anglická verze**
> [ADR-001-block-field-visibility.md](ADR-001-block-field-visibility.md). Pokud se texty
> liší, platí anglická verze. Při změně originálu se aktualizuje i tento překlad.

**Stav:** Navrženo
**Datum:** 2026-09-26
**Rozhodují:** CassandraGargoyle

## Kontext

Bloky první verze (INT-001) ukazují všechno, co obsahují. Odstavec je jeho text, obrázek
je jeho obrázek a popisek. To, co blok ukládá, a to, co čtenář vidí, je totéž.

Blok adresy ([INT-003](../issues/003-address-block.md)) to porušuje. Obsahuje poštovní
adresu a GPS souřadnice místa. Čtenář dokumentu o rodinném domě chce adresu. Souřadnice
jsou tu pro toho, kdo dokument upravuje, a pro aplikaci, která ho vkládá: aby dům zobrazila
na mapě nebo k němu navigovala. Vytištěné pod adresou jsou jen šumem.

Adresa nebude jediný takový blok. Kontakt obsahuje telefonní číslo, které jeden dokument
ukazuje a jiný ne, a zařízení má sériové číslo, které patří do inventáře, ale ne do
návodu. Jde tedy o pravidlo pro každý typ bloku, ne o zvláštní případ v bloku adresy.

Je potřeba odpovědět na čtyři otázky:

1. Kdo rozhoduje, která pole se zobrazí: typ bloku, aplikace, nebo autor dokumentu?
2. Co ukazuje editace?
3. Mění skrytí pole to, co lze přes API číst nebo zapisovat?
4. Jak se volba ukládá, aby pozdější verze typu s více poli nerozbila dokumenty napsané
   před ní?

## Rozhodnutí

**Každý typ bloku deklaruje svá pole a výchozí zobrazení**, tedy pole, která dokument
ukazuje. Adresa ukazuje ulici, číslo domu, PSČ, město a stát a neukazuje `gps`. Typ, jehož
pole se ukazují všechna, je přesto deklaruje, aby je přepis mohl jmenovat.

**Výchozí nastavení lze přepsat na dvou dalších úrovních a vyhrává ta nejkonkrétnější:**

| Úroveň | Kde | Rozsah | Příklad |
| ------ | --- | ------ | ------- |
| 1. Typ | Vlastní kód komponenty | Každý blok daného typu | `gps` skryté |
| 2. Hostitel | Prop `fieldVisibility` komponenty `BlockDocument` | Každý blok daného typu v tomto zobrazení | Inventární aplikace ukazuje `gps` všude |
| 3. Blok | Klíč `visibility` bloku v dokumentu | Tento jeden blok | Tato jedna adresa ukazuje své `gps` |

Přepis je **mapa názvů polí na booleovské hodnoty**, `{ "gps": true, "country": false }`,
nikdy úplný seznam. Pole, které mapa nejmenuje, si ponechá hodnotu z nižší úrovně. Pole,
které typ přidá v pozdější verzi, proto dostane výchozí hodnotu daného typu a potichu
nezmizí z dokumentů, které přepsaly něco jiného. Název, který typ nezná, se ignoruje a
zachová.

```json
{
  "id": "house-address",
  "type": "address",
  "street": "Lipová",
  "houseNumber": "12",
  "postalCode": "251 01",
  "city": "Říčany",
  "gps": { "lat": 49.9917, "lon": 14.6543 },
  "visibility": { "country": false }
}
```

```tsx
<BlockDocument document={doc} fieldVisibility={{ address: { gps: true } }} />
```

**Editace ukazuje všechna pole.** Pole, které je v dokumentu skryté, je ve formuláři bloku
stále vstupem, označeným *není zobrazeno v dokumentu*. Vedle každého pole má formulář
přepínač *Zobrazit v dokumentu*, který zapisuje `visibility` bloku, takže úroveň 3 lze
nastavit bez zásahu do JSON. Přepínač začíná na hodnotě, kterou dávají tři úrovně.

**Viditelnost je prezentace, ne řízení přístupu.** Skryté pole je v dokumentu, vrací se při
čtení dokumentu a `updateBlock` ho zapisuje jako kterékoli jiné pole. Komponenta ho nikdy
nezahazuje, nemaskuje ani neodstraňuje. Aplikace, která nesmí souřadnice prozradit, je
musí odstranit z dat dřív, než dokument předá dál. Skrytí v zobrazení je soukromými
nečiní.

## Důsledky

**Typ bloku popisují jeho pole, ne jen jeho vykreslení.** Každý známý typ dostane seznam
polí s výchozí viditelností. Vykreslení se ptá, která pole jsou viditelná, a formulář pro
editaci se ptá, která pole existují. Přidat pole do typu znamená přidat ho do toho seznamu
a nic dalšího se o něm učit nemusí.

**Stávající typy se nemění.** Kapitola, odstavec, obrázek a video deklarují svá pole jako
všechna viditelná, takže už napsané dokumenty vypadají stejně. Hostitel přesto může přes
úroveň 2 skrýt třeba `caption` u všech obrázků.

**Formát zůstává na `schemaVersion` 1.** `visibility` je volitelný klíč bloku. Starší
komponenta ho ignoruje, stejně jako každý klíč, který nezná, a ukazuje pole, která ukazuje
dnes. Žádný dokument se nestane neplatným.

**Skryté pole může čtenáře překvapit.** Kdo čte JSON nebo z něj exportovaný dokument, najde
souřadnice, které stránka nikdy neukázala. To je cena výše uvedeného pravidla a důvod, proč
formulář pro editaci každé skryté pole označí, místo aby ho vynechal.

**Když se hostitel a autor neshodnou, vyhrává autor.** Hostitel, který nastaví
`{ gps: false }`, neskryje souřadnice bloku, jehož autor nastavil `{ gps: true }`. Toto
rozhodnutí je nejvíce otevřené nesouhlasu. Pro něj mluví to, že přepis na bloku je
nejkonkrétnější vyjádření, jaké kdo učinil. Proti němu mluví to, že aplikace zná své
publikum. Přijatelné je jen proto, že viditelnost není řízení přístupu. Hostitel, který si
musí být jistý, data odstraní.

**Zamítnuto: seznam viditelných polí na bloku.** `"visible": ["street", "city"]` se čte
snáz, ale blok, který ho použije, zmrazí sadu svých polí. Pole, které typ později přidá,
je pak v každém takovém bloku skryté, aniž by o tom kdo rozhodl.

**Zamítnuto: pojmenované profily zobrazení** (`"view": "compact"`, `"view": "full"`)
definované pro každý typ. Čtou se dobře, ale každá nová potřeba si žádá další profil
definovaný v komponentě a profil stejně neumí říct „toto jedno pole, pro tento jeden
blok“. Mapa pokryje obojí a profily nad ní lze postavit později, pokud budou někdy
potřeba.

**Zamítnuto: skrývání v datech.** Komponenta by mohla skrytá pole vynechat z toho, co
předává do `onChange`, nebo je držet mimo dokument. Dokument by pak přestal být úplným
popisem bloku a aplikace čtoucí `gps` by závisela na tom, jak byl blok naposledy zobrazen.
