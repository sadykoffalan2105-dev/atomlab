import type { HclMechanismText } from './hclMechanismText'

/** O‘zbekcha dars matni: zanjirli reaksiya H₂ + Cl₂ → 2 HCl. */
export const HCL_TEXT_UZ: HclMechanismText = {
  intro: {
    title: 'Zanjirli reaksiya',
    speak: 'Vodorod va xlor qanday qilib vodorod xloridga aylanishini ko‘ramiz: bitta yorug‘lik uchquni butun zanjirni harakatga keltiradi.',
  },
  steps: {
    mixture: {
      title: 'Qorong‘ilikdagi aralashma',
      body:
        'Idishda ikkita sodda modda bor: vodorod molekulalari H₂ (bog‘ uzunligi 74,1 pm) va xlor molekulalari Cl₂ (198,8 pm). Ikkalasi ham 25 °C da gaz va ikki atomli — bu yerda erkin atomlar yo‘q. ' +
        'Qorong‘ilikda aralashma yillab turishi mumkin: Cl–Cl bog‘ini uzish uchun molga 243 kJ kerak, xona issiqligi esa buning uchun yetmaydi. ' +
        'O‘lchamlarga e’tibor bering: vodorodning kovalent radiusi 31 pm, xlorniki 102 pm — vodorod uch barobar kichik.',
      equation: 'H₂ (gaz) + Cl₂ (gaz) — qorong‘ilikda reaksiya yo‘q',
      note: 'Kadrda bir nechta molekula ko‘rsatilgan; oddiy sharoitda bir litr gazda ularning soni taxminan 2,7 · 10²² ta.',
      speak: 'Idishda vodorod va xlor bor. Qorong‘ilikda ular reaksiyaga kirishmaydi: bog‘ni uzishga energiya yetmaydi.',
    },
    initiation: {
      title: 'Yorug‘lik kvanti: zanjirning boshlanishi',
      body:
        'To‘lqin uzunligi 492 nm dan katta bo‘lmagan — ko‘k yoki binafsha — bitta yorug‘lik kvanti Cl–Cl bog‘ini uzishga yetadi. ' +
        'Uzilish GOMOLITIK: umumiy juft teng bo‘linadi, har bir atomga bittadan elektron tegadi. Natijada juftlashmagan elektronga ega ikkita juda faol Cl• radikali hosil bo‘ladi. ' +
        'Bu bosqich zanjirning boshlanishi deyiladi va butun reaksiya davomida faqat bir marta sodir bo‘ladi.',
      equation: 'Cl₂ + hν → 2 Cl•,  D(Cl–Cl) = 243 kJ/mol',
      note: 'Juftlashmagan elektron yorug‘ halqadagi bitta nuqta bilan chizilgan — bu shartli belgi, orbita emas: elektron yadro atrofida «yoyilgan».',
      speak: 'Ko‘k yorug‘lik kvanti xlor molekulasini ikkiga bo‘ladi. Juftlashmagan elektronli ikkita radikal paydo bo‘ladi.',
    },
    propagation1: {
      title: 'Zanjirning birinchi bo‘g‘ini',
      body:
        'Cl• radikali vodorod molekulasiga urilib, undan bitta atomni uzib oladi: birinchi HCl molekulasi tug‘iladi, ikkinchi vodorod atomi esa H• radikali bo‘lib qoladi. ' +
        'Uzunligi 127,5 pm bo‘lgan H–Cl bog‘i QUTBLI KOVALENT: umumiy juft xlor tomonga siljigan, chunki uning elektrmanfiyligi kattaroq (2,20 ga qarshi 3,16, farqi 0,96). Xlorda δ−, vodorodda δ+ paydo bo‘ladi; bog‘ning ionlik ulushi atigi 18 % ga yaqin, gazda ionlar yo‘q. ' +
        'Bu bosqich biroz endotermik: ΔH = +4 kJ/mol, va u zanjirdagi eng sekin bo‘g‘in.',
      equation: 'Cl• + H₂ → HCl + H•,  ΔH = +4 kJ/mol',
      note: 'Rasmda elektron zichligining xlor tomon siljishi uch barobar KUCHAYTIRILGAN: haqiqiy 18 % deyarli ko‘rinmas edi.',
      speak: 'Xlor radikali vodorod atomini uzib oladi. Vodorod xlorid va yangi vodorod radikali hosil bo‘ladi.',
    },
    propagation2: {
      title: 'Ikkinchi bo‘g‘in — zanjir aylanadi',
      body:
        'H• radikali keyingi Cl₂ molekulasiga uriladi: ikkinchi HCl molekulasi va yana Cl• radikali — hammasi boshlangan aynan o‘sha radikal — hosil bo‘ladi. ' +
        'Bu bosqich molga 189 kJ chiqaradi, shuning uchun aralashma o‘zi qiziydi. Tiklangan radikal darhol yangi vodorod molekulasiga hujum qiladi va aylana takrorlanadi. ' +
        'Zanjir o‘sishining ikki bosqichini qo‘shamiz: (+4) + (−189) = −184,6 kJ — bu butun reaksiyaning issiqlik effekti. Kvant energiyasi BIR marta sarflandi, foyda esa har aylanada olinadi.',
      equation: 'H• + Cl₂ → HCl + Cl•,  ΔH = −189 kJ/mol',
      note: 'Zanjirning chuqur bo‘g‘inlari o‘rniga to‘rtta tayyor HCl molekulasi ko‘rsatilgan; aslida bitta yutilgan kvant taxminan 10⁶ ta molekula beradi — bu tartib bahosi.',
      speak: 'Vodorod radikali xlor molekulasini uzadi. Xlor radikali qaytadi va zanjir yana aylanadi.',
    },
    termination: {
      title: 'Zanjirning uzilishi',
      body:
        'Zanjir aralashmada radikallar bor ekan yashaydi. U ikkita radikal uchrashib birikkanda tugaydi: Cl• + Cl• → Cl₂. Molga 243 kJ ajraladi — kvant bog‘ni uzishga sarflagan miqdorning o‘zi. ' +
        'Idish devori ham xuddi shu vazifani bajaradi: radikal ortiqcha energiyani unga berib yo‘qoladi. Shuning uchun tor naychada reaksiya keng idishdagiga qaraganda sekinroq boradi. ' +
        'Boshlanish va uzilish bir-birini yo‘qotadi, shuning uchun ular reaksiyaning issiqlik effektiga kirmaydi.',
      equation: 'Cl• + Cl• → Cl₂,  ΔH = −243 kJ/mol',
      note: 'Ikki atomning birikishi uchun ortiqcha energiyani olib ketadigan uchinchi zarra (devor yoki boshqa molekula) kerak — u kadrda chizilmagan.',
      speak: 'Ikki radikal uchrashib, yana xlor molekulasini hosil qiladi. Zanjir uziladi.',
    },
    energy: {
      title: 'Energiya yakuni',
      body:
        'Issiqlik effektini bog‘ energiyalari bo‘yicha hisoblaymiz: H–H (+436) va Cl–Cl (+243) bog‘larini uzamiz, ikkita H–Cl bog‘ini yig‘amiz (−2 · 431 = −862). Jami −183 kJ. ' +
        'Mustaqil ravishda, hosil bo‘lish issiqliklari bo‘yicha: 2 · ΔH°f(HCl) = 2 · (−92,3) = −184,6 kJ. Ikki xil yo‘l deyarli bir xil natija beradi — bu Gess qonuni. ' +
        'Shuning uchun yorqin quyoshda vodorod va xlor aralashmasi portlaydi, qorong‘ilikda esa deyarli reaksiyaga kirishmaydi: gap reaksiya issiqligida emas, birinchi Cl–Cl bog‘ini kim uzishida.',
      equation: 'H₂ (gaz) + Cl₂ (gaz) → 2 HCl (gaz),  ΔH = −184,6 kJ',
      note: 'Ikki hisob orasidagi 1,6 kJ farq — O‘RTACHA bog‘ energiyalarining odatdagi narxi: ular o‘rtachalab jadvallanadi, hosil bo‘lish issiqligi esa bevosita o‘lchanadi.',
      speak: 'Natija: minus bir yuz sakson besh kilojoul. Quyoshda aralashma portlaydi, qorong‘ilikda deyarli reaksiyaga kirishmaydi.',
    },
  },
  legend: {
    electron: 'Ko‘k nuqta — radikalning juftlashmagan elektroni yoki yangi bog‘ning umumiy jufti.',
    orbitalPhase: 'Atom atrofidagi yorug‘ halqa — tashqi elektron qavatning shartli belgisi, orbital shakli emas.',
  },
  safety:
    'Vodorod va xlor aralashmasi yorqin yorug‘likdan yoki chaqnashdan portlaydi. Xlor zaharli, vodorod xlorid nafas yo‘llarini kuydiradi. Bu tajribani faqat o‘qituvchi tortish shkafida, himoya ekrani ortida o‘tkazadi — uni o‘zingiz takrorlash mumkin emas.',
  energy: {
    title: 'Bog‘ energiyalari',
    unit: 'kJ/mol',
    caption: 'H₂ + Cl₂ → 2 HCl tenglamasi uchun uziladigan (yuqoriga) va hosil bo‘ladigan (pastga) bog‘lar; yig‘indi — issiqlik effekti.',
    stages: {
      bondClCl: 'Cl₂ → 2 Cl•',
      bondHH: 'H₂ → 2 H•',
      bondHCl: '2 H• + 2 Cl• → 2 HCl',
      total: 'Yakun: reaksiyaning ΔH si',
    },
    summary: 'H₂ + Cl₂ → 2 HCl uchun bog‘ energiyalari: bosqichlar yig‘indisi {dH} kJ',
    sources: 'Ma’lumotnoma qiymatlari: bog‘ energiyalari va uzunliklari — CRC Handbook; hosil bo‘lish issiqliklari — NIST-JANAF.',
  },
}
