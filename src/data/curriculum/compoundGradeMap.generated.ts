/**
 * АВТОГЕНЕРАЦИЯ — не редактировать вручную.
 * Пересборка: npx tsx scripts/build-compound-grade-map.mts
 * Источники: сверка учебников Kimyo 7–11 (evidence + TEXTBOOK_EXTRA_GRADES), schoolInorganicManifest, правила ФГОС.
 * Статистика: 7 кл.=176, 8 кл.=277, 9 кл.=304, 10 кл.=93, 11 кл.=180, всего=478; органика=49
 */
import type { InorganicSchoolGrade } from './compoundGradeIndex'

export type InorganicChapter =
  | 'вода'
  | 'оксиды'
  | 'кислоты'
  | 'основания'
  | 'соли'
  | 'металлы'
  | 'неметаллы'
  | 'кислород'
  | 'водород'
  | 'качественные'
  | 'азот'
  | 'сера'
  | 'фосфор'
  | 'хром'
  | 'хлор'
  | 'марганец'
  | 'кремний'
  | 'катализ'
  | 'прочее'

export type CompoundGradeEntry = {
  grades: readonly InorganicSchoolGrade[]
  chapter: InorganicChapter
  /** Первая страница учебника, где вещество встречается (порядок «как в книге»). */
  firstPage?: number
}

export type OrganicGradeEntry = {
  grades: readonly InorganicSchoolGrade[]
  firstPage?: number
}

export const COMPOUND_GRADE_MAP: Readonly<Record<string, CompoundGradeEntry>> = {
  "h2o": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "вода",
    "firstPage": 10
  },
  "co2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 10
  },
  "nacl": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 12
  },
  "co": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "so2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "so3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 52
  },
  "no": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "no2": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 55
  },
  "n2o": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "азот",
    "firstPage": 60
  },
  "n2o5": {
    "grades": [
      7,
      8,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 106
  },
  "p2o5": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "фосфор",
    "firstPage": 63
  },
  "sio2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "кремний",
    "firstPage": 14
  },
  "li2o": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 95
  },
  "na2o": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "k2o": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "mgo": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 53
  },
  "cao": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 61
  },
  "bao": {
    "grades": [
      7,
      8,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 64
  },
  "sro": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 13
  },
  "al2o3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 53
  },
  "feo": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды",
    "firstPage": 64
  },
  "fe2o3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "fe3o4": {
    "grades": [
      7,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 73
  },
  "cuo": {
    "grades": [
      7,
      8,
      9,
      10
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "cu2o": {
    "grades": [
      7,
      9,
      10
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "zno": {
    "grades": [
      7,
      8,
      9,
      10
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "ago": {
    "grades": [
      7,
      10
    ],
    "chapter": "оксиды",
    "firstPage": 102
  },
  "pbo": {
    "grades": [
      8,
      9
    ],
    "chapter": "оксиды",
    "firstPage": 20
  },
  "pbo2": {
    "grades": [
      11
    ],
    "chapter": "оксиды",
    "firstPage": 45
  },
  "mno2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "катализ",
    "firstPage": 90
  },
  "cr2o3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "хром",
    "firstPage": 72
  },
  "cro3": {
    "grades": [
      7,
      8,
      9,
      10
    ],
    "chapter": "хром",
    "firstPage": 63
  },
  "sno2": {
    "grades": [
      9
    ],
    "chapter": "оксиды",
    "firstPage": 49
  },
  "h2o2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "кислород",
    "firstPage": 32
  },
  "na2o2": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 95
  },
  "clo2": {
    "grades": [
      8,
      9
    ],
    "chapter": "хлор"
  },
  "hcl": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 52
  },
  "hbr": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 63
  },
  "hi": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 117
  },
  "hf": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 117
  },
  "fes2": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "сера",
    "firstPage": 96
  },
  "h2s": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 63
  },
  "h2so4": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 19
  },
  "h2so3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 53
  },
  "hno3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 55
  },
  "hno2": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 164
  },
  "h3po4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 55
  },
  "h3po3": {
    "grades": [
      11
    ],
    "chapter": "кислоты",
    "firstPage": 97
  },
  "h2co3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 90
  },
  "h2sio3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кремний",
    "firstPage": 119
  },
  "hclo4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 107
  },
  "hclo3": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 118
  },
  "hclo": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 121
  },
  "hmno4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "марганец",
    "firstPage": 120
  },
  "h2cro4": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 148
  },
  "naoh": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "основания",
    "firstPage": 67
  },
  "koh": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "основания",
    "firstPage": 70
  },
  "lioh": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "основания",
    "firstPage": 149
  },
  "csoh": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания",
    "firstPage": 21
  },
  "ba_oh_2": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "основания",
    "firstPage": 141
  },
  "ca_oh_2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "основания",
    "firstPage": 34
  },
  "mg_oh_2": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "основания",
    "firstPage": 121
  },
  "cu_oh_2": {
    "grades": [
      7,
      8,
      9,
      10
    ],
    "chapter": "основания",
    "firstPage": 107
  },
  "fe_oh_2": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "основания",
    "firstPage": 12
  },
  "fe_oh_3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "основания",
    "firstPage": 143
  },
  "al_oh_3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "основания",
    "firstPage": 66
  },
  "zn_oh_2": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "основания",
    "firstPage": 12
  },
  "nh3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "азот",
    "firstPage": 21
  },
  "nh3_h2o": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "азот",
    "firstPage": 107
  },
  "salt_na_br": {
    "grades": [
      8,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 22
  },
  "salt_na_i": {
    "grades": [
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 22
  },
  "salt_na_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 22
  },
  "salt_na_no2": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 173
  },
  "salt_na_no3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 73
  },
  "salt_na_clo2": {
    "grades": [
      8
    ],
    "chapter": "хлор",
    "firstPage": 117
  },
  "salt_na_clo3": {
    "grades": [
      8
    ],
    "chapter": "хлор",
    "firstPage": 117
  },
  "salt_na_so4": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 106
  },
  "salt_na_so3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 143
  },
  "salt_na_co3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 9
  },
  "salt_na_s": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 64
  },
  "salt_na_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 181
  },
  "salt_na_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 148
  },
  "salt_k_cl": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 64
  },
  "salt_k_br": {
    "grades": [
      8,
      11
    ],
    "chapter": "соли",
    "firstPage": 73
  },
  "salt_k_i": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 102
  },
  "salt_k_f": {
    "grades": [
      7
    ],
    "chapter": "соли",
    "firstPage": 53
  },
  "salt_k_no2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 93
  },
  "salt_k_no3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 90
  },
  "salt_k_mno4": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 93
  },
  "salt_k_clo3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "хлор",
    "firstPage": 93
  },
  "salt_k_clo4": {
    "grades": [
      9
    ],
    "chapter": "хлор"
  },
  "salt_k_so4": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 80
  },
  "salt_k_so3": {
    "grades": [
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 36
  },
  "salt_k_co3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 70
  },
  "salt_k_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 66
  },
  "salt_k_sio3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 64
  },
  "salt_k_cro4": {
    "grades": [
      9,
      11
    ],
    "chapter": "хром",
    "firstPage": 149
  },
  "salt_li_cl": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 83
  },
  "salt_li_f": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 71
  },
  "salt_li_no3": {
    "grades": [
      7,
      11
    ],
    "chapter": "соли",
    "firstPage": 149
  },
  "salt_li_so4": {
    "grades": [
      8,
      11
    ],
    "chapter": "соли",
    "firstPage": 21
  },
  "salt_li_co3": {
    "grades": [
      7,
      11
    ],
    "chapter": "соли",
    "firstPage": 121
  },
  "salt_li_s": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 133
  },
  "salt_nh4_cl": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 9
  },
  "salt_nh4_no2": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 61
  },
  "salt_nh4_no3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 102
  },
  "salt_nh4_so4": {
    "grades": [
      8,
      11
    ],
    "chapter": "соли",
    "firstPage": 161
  },
  "salt_nh4_co3": {
    "grades": [
      8,
      11
    ],
    "chapter": "соли",
    "firstPage": 162
  },
  "salt_nh4_cr2o7": {
    "grades": [
      9,
      11
    ],
    "chapter": "хром",
    "firstPage": 147
  },
  "salt_ag_cl": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "качественные",
    "firstPage": 82
  },
  "salt_ag_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "качественные",
    "firstPage": 120
  },
  "salt_ag_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "качественные",
    "firstPage": 120
  },
  "salt_ag_no3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "качественные",
    "firstPage": 121
  },
  "salt_ag_s": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли",
    "firstPage": 73
  },
  "salt_cs_cl": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 21
  },
  "salt_cs_f": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 29
  },
  "salt_cs_so4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 21
  },
  "salt_mg_so4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 143
  },
  "salt_mg_co3": {
    "grades": [
      7,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 53
  },
  "salt_mg_s": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 111
  },
  "salt_mg_sio3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 111
  },
  "salt_mg_cl": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 67
  },
  "salt_mg_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 92
  },
  "salt_mg_i": {
    "grades": [
      8,
      11
    ],
    "chapter": "соли",
    "firstPage": 87
  },
  "salt_mg_no3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 111
  },
  "salt_ca_so4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 72
  },
  "salt_ca_so3": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 136
  },
  "salt_ca_co3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 30
  },
  "salt_ca_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 134
  },
  "salt_ca_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 174
  },
  "salt_ca_cl": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 64
  },
  "salt_ca_i": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 73
  },
  "salt_ca_f": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 66
  },
  "salt_ca_no3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 73
  },
  "salt_ba_so4": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "качественные",
    "firstPage": 67
  },
  "salt_ba_co3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 43
  },
  "salt_ba_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 151
  },
  "salt_ba_cl": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 67
  },
  "salt_ba_br": {
    "grades": [
      7
    ],
    "chapter": "соли",
    "firstPage": 73
  },
  "salt_ba_i": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 144
  },
  "salt_ba_no3": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 15
  },
  "salt_ba_mno4": {
    "grades": [
      9
    ],
    "chapter": "марганец"
  },
  "salt_ba_clo3": {
    "grades": [
      9
    ],
    "chapter": "хлор"
  },
  "salt_zn_so4": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 138
  },
  "salt_zn_co3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 141
  },
  "salt_zn_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 107
  },
  "salt_zn_cl": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 67
  },
  "salt_zn_br": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 54
  },
  "salt_zn_no3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 107
  },
  "salt_cu_so4": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 66
  },
  "salt_cu_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 71
  },
  "salt_cu_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_cl": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 53
  },
  "salt_cu_no3": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 85
  },
  "salt_fe2_so4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 116
  },
  "salt_fe2_co3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 43
  },
  "salt_fe2_s": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 59
  },
  "salt_fe2_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 62
  },
  "salt_fe2_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 16
  },
  "salt_pb_so4": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 65
  },
  "salt_pb_co3": {
    "grades": [
      7
    ],
    "chapter": "соли",
    "firstPage": 120
  },
  "salt_pb_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 131
  },
  "salt_pb_cl": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 117
  },
  "salt_pb_br": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 120
  },
  "salt_pb_i": {
    "grades": [
      8,
      11
    ],
    "chapter": "соли",
    "firstPage": 120
  },
  "salt_pb_no3": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 134
  },
  "salt_mn_so4": {
    "grades": [
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 85
  },
  "salt_mn_s": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 153
  },
  "salt_mn_cl": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 85
  },
  "salt_mn_no3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 153
  },
  "salt_ni_f": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 144
  },
  "salt_ni_no3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 95
  },
  "salt_al_po4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 113
  },
  "salt_al_cl": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 64
  },
  "salt_al_br": {
    "grades": [
      7,
      11
    ],
    "chapter": "соли",
    "firstPage": 53
  },
  "salt_al_i": {
    "grades": [
      7,
      11
    ],
    "chapter": "соли",
    "firstPage": 70
  },
  "salt_al_f": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли",
    "firstPage": 53
  },
  "salt_al_no3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 107
  },
  "salt_al_so4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 73
  },
  "salt_al_co3": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 61
  },
  "salt_al_s": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 72
  },
  "salt_al_cr2o7": {
    "grades": [
      11
    ],
    "chapter": "хром",
    "firstPage": 29
  },
  "salt_fe3_po4": {
    "grades": [
      7
    ],
    "chapter": "соли",
    "firstPage": 143
  },
  "salt_fe3_cl": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 64
  },
  "salt_fe3_no3": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 166
  },
  "salt_fe3_so4": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 85
  },
  "salt_fe3_co3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 37
  },
  "salt_fe3_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cr_cl": {
    "grades": [
      9,
      11
    ],
    "chapter": "хром",
    "firstPage": 145
  },
  "salt_cr_no3": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 147
  },
  "salt_cr_so4": {
    "grades": [
      8,
      9,
      10,
      11
    ],
    "chapter": "хром",
    "firstPage": 84
  },
  "salt_cr_s": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 146
  },
  "salt_nh4_3_po4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 161
  },
  "salt_nahco3": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 21
  },
  "salt_khco3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 53
  },
  "salt_ca_hco3_2": {
    "grades": [
      8,
      9,
      10
    ],
    "chapter": "соли",
    "firstPage": 15
  },
  "salt_k2cr2o7": {
    "grades": [
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 79
  },
  "tb_s8": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 74
  },
  "tb_p4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 74
  },
  "tb_i2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "прочее",
    "firstPage": 13
  },
  "tb_br2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "прочее",
    "firstPage": 39
  },
  "tb_cl2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "прочее",
    "firstPage": 39
  },
  "tb_f2": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 53
  },
  "tb_n2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "прочее",
    "firstPage": 35
  },
  "tb_o3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 53
  },
  "tb_o2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "прочее",
    "firstPage": 18
  },
  "tb_h2": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "прочее",
    "firstPage": 53
  },
  "tb_ca3po42": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 73
  },
  "tb_ph3": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 53
  },
  "tb_sih4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 53
  },
  "tb_cah2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее",
    "firstPage": 53
  },
  "tb_cac2": {
    "grades": [
      7,
      9,
      10
    ],
    "chapter": "прочее",
    "firstPage": 64
  },
  "tb_cuso4_5h2o": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 139
  },
  "tb_cl2o7": {
    "grades": [
      7,
      8,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 52
  },
  "tb_nah": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 63
  },
  "tb_nahso4": {
    "grades": [
      8,
      9,
      10
    ],
    "chapter": "соли",
    "firstPage": 16
  },
  "tb_na3po4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 73
  },
  "tb_cs2": {
    "grades": [
      7,
      8,
      9,
      10
    ],
    "chapter": "прочее",
    "firstPage": 108
  },
  "tb_cuoh2co3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 107
  },
  "tb_mn2o7": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды",
    "firstPage": 52
  },
  "tb_n2o3": {
    "grades": [
      7,
      8,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "tb_hgo": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды",
    "firstPage": 90
  },
  "tb_k2mno4": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "марганец",
    "firstPage": 93
  },
  "tb_k2o2": {
    "grades": [
      7,
      8,
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 94
  },
  "tb_kh": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 9
  },
  "tb_aucl3": {
    "grades": [
      8,
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 166
  },
  "tb_ccl4": {
    "grades": [
      10
    ],
    "chapter": "прочее",
    "firstPage": 17
  },
  "tb_kcl_nacl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 96
  },
  "tb_kcl_mgcl2_6h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 96
  },
  "tb_hpo3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты",
    "firstPage": 121
  },
  "tb_cro": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "хром",
    "firstPage": 141
  },
  "tb_cah2po42": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 15
  },
  "tb_kclo": {
    "grades": [
      8
    ],
    "chapter": "хлор",
    "firstPage": 98
  },
  "tb_ca5po43f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 119
  },
  "tb_nh42hpo4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 161
  },
  "tb_nh4h2po4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 161
  },
  "tb_caco3_mgco3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 43
  },
  "tb_al4c3": {
    "grades": [
      9,
      10
    ],
    "chapter": "прочее",
    "firstPage": 48
  },
  "tb_na2co3_10h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 55
  },
  "tb_al2o3_2sio2_2h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 60
  },
  "tb_k2o_al2o3_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 60
  },
  "tb_mn3o4": {
    "grades": [
      7,
      9,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 93
  },
  "tb_kcl_mgso4_3h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 96
  },
  "tb_caso4_2h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 131
  },
  "tb_feso4_7h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 10
  },
  "tb_na2so4_10h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 131
  },
  "tb_becl2": {
    "grades": [
      7,
      8
    ],
    "chapter": "соли",
    "firstPage": 53
  },
  "tb_h2se": {
    "grades": [
      7,
      8,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 63
  },
  "tb_mno": {
    "grades": [
      7,
      9
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "tb_mn2o3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды",
    "firstPage": 93
  },
  "tb_bao2": {
    "grades": [
      7,
      8
    ],
    "chapter": "прочее",
    "firstPage": 93
  },
  "tb_ko2": {
    "grades": [
      7,
      9
    ],
    "chapter": "прочее",
    "firstPage": 94
  },
  "tb_v2o5": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды",
    "firstPage": 96
  },
  "tb_naalo2": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли",
    "firstPage": 107
  },
  "tb_naaloh4": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли",
    "firstPage": 107
  },
  "tb_ag3po4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 121
  },
  "tb_beo": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды",
    "firstPage": 138
  },
  "tb_croh3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "хром",
    "firstPage": 143
  },
  "tb_croh2": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром",
    "firstPage": 12
  },
  "tb_cs2o": {
    "grades": [
      8,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 21
  },
  "tb_pcl3": {
    "grades": [
      8,
      11
    ],
    "chapter": "прочее",
    "firstPage": 66
  },
  "tb_cu2s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 131
  },
  "tb_ca3p2": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее",
    "firstPage": 176
  },
  "tb_mg2si": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 41
  },
  "tb_sic": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 49
  },
  "tb_hcn": {
    "grades": [
      9,
      10,
      11
    ],
    "chapter": "кислоты",
    "firstPage": 181
  },
  "tb_na3alf6": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 119
  },
  "tb_as2s3": {
    "grades": [
      7,
      11
    ],
    "chapter": "прочее",
    "firstPage": 9
  },
  "tb_na2b4o7_10h2o": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли",
    "firstPage": 9
  },
  "tb_cl2o5": {
    "grades": [
      7,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "tb_sb2o3": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды",
    "firstPage": 107
  },
  "tb_wo3": {
    "grades": [
      7,
      9
    ],
    "chapter": "оксиды",
    "firstPage": 118
  },
  "tb_mgh2": {
    "grades": [
      7,
      9
    ],
    "chapter": "прочее",
    "firstPage": 118
  },
  "tb_na2znoh4": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли",
    "firstPage": 118
  },
  "tb_h2cr2o7": {
    "grades": [
      7,
      9
    ],
    "chapter": "хром",
    "firstPage": 120
  },
  "tb_h4sio4": {
    "grades": [
      7,
      10
    ],
    "chapter": "кислоты",
    "firstPage": 121
  },
  "tb_h4p2o7": {
    "grades": [
      7,
      8
    ],
    "chapter": "кислоты",
    "firstPage": 121
  },
  "tb_tio2": {
    "grades": [
      7,
      10
    ],
    "chapter": "оксиды",
    "firstPage": 138
  },
  "tb_as2o5": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 14
  },
  "tb_na2zno2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 19
  },
  "tb_rb2o": {
    "grades": [
      8,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 21
  },
  "tb_rboh": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания",
    "firstPage": 21
  },
  "tb_pcl5": {
    "grades": [
      8,
      11
    ],
    "chapter": "прочее",
    "firstPage": 66
  },
  "tb_xef4": {
    "grades": [
      8,
      11
    ],
    "chapter": "прочее",
    "firstPage": 90
  },
  "tb_sbcl3": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее",
    "firstPage": 97
  },
  "tb_mg3po42": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 113
  },
  "tb_cucl": {
    "grades": [
      8,
      10
    ],
    "chapter": "соли",
    "firstPage": 117
  },
  "tb_hclo2": {
    "grades": [
      8,
      9
    ],
    "chapter": "хлор",
    "firstPage": 118
  },
  "tb_sif4": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее",
    "firstPage": 121
  },
  "tb_mg3n2": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее",
    "firstPage": 158
  },
  "tb_n2o4": {
    "grades": [
      8,
      11
    ],
    "chapter": "оксиды",
    "firstPage": 163
  },
  "tb_cahpo4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 178
  },
  "tb_k3po4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 184
  },
  "tb_cah2po42_2h2o": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 187
  },
  "tb_cah2po42_2h2o_caso4_2h2o": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 187
  },
  "tb_cn2": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 43
  },
  "tb_cf4": {
    "grades": [
      9,
      10
    ],
    "chapter": "прочее",
    "firstPage": 48
  },
  "tb_cocl2": {
    "grades": [
      9,
      11
    ],
    "chapter": "прочее",
    "firstPage": 50
  },
  "tb_sibr4": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 60
  },
  "tb_sis2": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 60
  },
  "tb_sicl4": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 60
  },
  "tb_kcn": {
    "grades": [
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 138
  },
  "tb_cdso4": {
    "grades": [
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 142
  },
  "tb_hgno32": {
    "grades": [
      9,
      11
    ],
    "chapter": "соли",
    "firstPage": 143
  },
  "tb_crcl2": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 145
  },
  "tb_mnoh2": {
    "grades": [
      9,
      11
    ],
    "chapter": "основания",
    "firstPage": 153
  },
  "tb_k3fecn6": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 161
  },
  "tb_k4fecn6": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 162
  },
  "tb_cunh34oh2": {
    "grades": [
      10
    ],
    "chapter": "основания",
    "firstPage": 164
  },
  "tb_ba3po42": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 34
  },
  "tb_haucl4": {
    "grades": [
      7,
      9
    ],
    "chapter": "кислоты",
    "firstPage": 121
  },
  "tb_caclo2": {
    "grades": [
      8,
      9
    ],
    "chapter": "хлор",
    "firstPage": 118
  },
  "tb_mgso4_7h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 131
  },
  "tb_kncs": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 162
  },
  "tb_fencs3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 162
  },
  "tb_si3n4": {
    "grades": [
      7
    ],
    "chapter": "прочее",
    "firstPage": 52
  },
  "tb_tic": {
    "grades": [
      7
    ],
    "chapter": "прочее",
    "firstPage": 53
  },
  "tb_au2o3": {
    "grades": [
      7
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "tb_cl2o3": {
    "grades": [
      7
    ],
    "chapter": "оксиды",
    "firstPage": 63
  },
  "tb_ticl4": {
    "grades": [
      7
    ],
    "chapter": "соли",
    "firstPage": 72
  },
  "tb_pb3o4": {
    "grades": [
      7
    ],
    "chapter": "оксиды",
    "firstPage": 90
  },
  "tb_agoh": {
    "grades": [
      7
    ],
    "chapter": "основания",
    "firstPage": 107
  },
  "tb_h2b4o7": {
    "grades": [
      7
    ],
    "chapter": "кислоты",
    "firstPage": 121
  },
  "tb_h4v2o7": {
    "grades": [
      7
    ],
    "chapter": "кислоты",
    "firstPage": 121
  },
  "tb_nio": {
    "grades": [
      7
    ],
    "chapter": "оксиды",
    "firstPage": 138
  },
  "tb_h2so4_h2o": {
    "grades": [
      7
    ],
    "chapter": "кислоты",
    "firstPage": 139
  },
  "tb_naoh_h2o": {
    "grades": [
      7
    ],
    "chapter": "основания",
    "firstPage": 139
  },
  "tb_bh3": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 9
  },
  "tb_rbh": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 9
  },
  "tb_sno": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 13
  },
  "tb_aloh2cl": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 15
  },
  "tb_caohcl": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 15
  },
  "tb_kalso42": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 15
  },
  "tb_khso4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 15
  },
  "tb_mgohno3": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 15
  },
  "tb_nh4also42": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 15
  },
  "tb_beoh2": {
    "grades": [
      8
    ],
    "chapter": "основания",
    "firstPage": 20
  },
  "tb_na2beo2": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 20
  },
  "tb_rb2so4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 21
  },
  "tb_rbcl": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 21
  },
  "tb_i2o7": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 22
  },
  "tb_halo2": {
    "grades": [
      8
    ],
    "chapter": "кислоты",
    "firstPage": 27
  },
  "tb_b2o3": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 28
  },
  "tb_ash3": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 55
  },
  "tb_gecl4": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 56
  },
  "tb_geo2": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 56
  },
  "tb_clf3": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 79
  },
  "tb_xeo4": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 79
  },
  "tb_lih": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 82
  },
  "tb_mgcl2_6h2o": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 96
  },
  "tb_pboh2": {
    "grades": [
      8
    ],
    "chapter": "основания",
    "firstPage": 113
  },
  "tb_hgcl2": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 117
  },
  "tb_naclo": {
    "grades": [
      8
    ],
    "chapter": "хлор",
    "firstPage": 117
  },
  "tb_kio3": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 120
  },
  "tb_naio3": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 120
  },
  "tb_xef2": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 121
  },
  "tb_h2te": {
    "grades": [
      8
    ],
    "chapter": "кислоты",
    "firstPage": 130
  },
  "tb_na2se": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 130
  },
  "tb_na2te": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 130
  },
  "tb_seo2": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 130
  },
  "tb_seo3": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 130
  },
  "tb_teo2": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 130
  },
  "tb_teo3": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 130
  },
  "tb_cahso32": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 132
  },
  "tb_scl2": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 132
  },
  "tb_sf6": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 133
  },
  "tb_li3n": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 158
  },
  "tb_nh4hso4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 161
  },
  "tb_ptcl4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 166
  },
  "tb_cacn2": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 173
  },
  "tb_p2s3": {
    "grades": [
      8
    ],
    "chapter": "прочее",
    "firstPage": 176
  },
  "tb_p4o10": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 177
  },
  "tb_na2hpo4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 178
  },
  "tb_nah2po4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 178
  },
  "tb_ca5po43oh": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 180
  },
  "tb_nanh4hpo4": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 181
  },
  "tb_napo3": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 181
  },
  "tb_cahpo4_2h2o": {
    "grades": [
      8
    ],
    "chapter": "соли",
    "firstPage": 191
  },
  "tb_feohcl2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 35
  },
  "tb_feoh2cl": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 35
  },
  "tb_sboh2cl": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 35
  },
  "tb_sbocl": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 35
  },
  "tb_k2sif6": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 60
  },
  "tb_sii4": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 60
  },
  "tb_na2o_cao_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 66
  },
  "tb_coo": {
    "grades": [
      9
    ],
    "chapter": "оксиды",
    "firstPage": 66
  },
  "tb_feh2po42": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 83
  },
  "tb_fehpo4": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 83
  },
  "tb_fe3po42": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 83
  },
  "tb_ptno32": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 95
  },
  "tb_na2o_al2o3_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 100
  },
  "tb_nanh2": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 100
  },
  "tb_nh4hco3": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 106
  },
  "tb_cao_3mgo_4sio2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 109
  },
  "tb_caso4_h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 110
  },
  "tb_ca3n2": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 110
  },
  "tb_mgo_cao": {
    "grades": [
      9
    ],
    "chapter": "оксиды",
    "firstPage": 111
  },
  "tb_caso42_h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 115
  },
  "tb_mghco32": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 117
  },
  "tb_na2o_al2o3_2sio2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 122
  },
  "tb_k2o_2h2o_3al2o3_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 122
  },
  "tb_alh3": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 122
  },
  "tb_aln": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 122
  },
  "tb_alp": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 125
  },
  "tb_al2so43_18h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 128
  },
  "tb_kalo2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 130
  },
  "tb_kalso42_12h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 130
  },
  "tb_cufes2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 133
  },
  "tb_cucl2_2h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 135
  },
  "tb_cuno32_3h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 135
  },
  "tb_kaucn2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 138
  },
  "tb_k2zncn4": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 138
  },
  "tb_cds": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 141
  },
  "tb_hgs": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 141
  },
  "tb_k2znoh4": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 142
  },
  "tb_cdoh2": {
    "grades": [
      9
    ],
    "chapter": "основания",
    "firstPage": 142
  },
  "tb_hgoh2": {
    "grades": [
      9
    ],
    "chapter": "основания",
    "firstPage": 142
  },
  "tb_znso4_7h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 142
  },
  "tb_hg2o": {
    "grades": [
      9
    ],
    "chapter": "оксиды",
    "firstPage": 143
  },
  "tb_feo_cr2o3": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 144
  },
  "tb_crn": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 146
  },
  "tb_nacro2": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 147
  },
  "tb_na3croh6": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 148
  },
  "tb_k2so4_cr2so43_12h2o": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 148
  },
  "tb_nh42so4_cr2so43_6h2o": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 148
  },
  "tb_crso4": {
    "grades": [
      9
    ],
    "chapter": "хром",
    "firstPage": 149
  },
  "tb_mn3n2": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 153
  },
  "tb_mnso4_4h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 155
  },
  "tb_h2mno4": {
    "grades": [
      9
    ],
    "chapter": "марганец",
    "firstPage": 157
  },
  "tb_fen": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 159
  },
  "tb_fe2so43_9h2o": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 163
  },
  "tb_al2o3_3beo_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 173
  },
  "tb_cu2c2": {
    "grades": [
      10
    ],
    "chapter": "прочее",
    "firstPage": 76
  },
  "tb_hgso4": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 133
  },
  "tb_cuoh": {
    "grades": [
      10
    ],
    "chapter": "основания",
    "firstPage": 134
  },
  "tb_n2h4": {
    "grades": [
      10
    ],
    "chapter": "прочее",
    "firstPage": 138
  },
  "tb_nh2oh": {
    "grades": [
      10
    ],
    "chapter": "прочее",
    "firstPage": 138
  },
  "tb_agnh32oh": {
    "grades": [
      10
    ],
    "chapter": "основания",
    "firstPage": 158
  },
  "tb_al4p2o73": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 29
  },
  "tb_sr3po42": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 30
  },
  "tb_bino33": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 53
  },
  "tb_nioh2": {
    "grades": [
      11
    ],
    "chapter": "основания",
    "firstPage": 54
  },
  "tb_nacn": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 61
  },
  "tb_na2s2o3": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 100
  },
  "tb_nocl": {
    "grades": [
      11
    ],
    "chapter": "прочее",
    "firstPage": 120
  },
  "tb_h3aso4": {
    "grades": [
      11
    ],
    "chapter": "кислоты",
    "firstPage": 127
  },
  "tb_na2c2o4": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 138
  },
  "tb_cdno32": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 154
  },
  "tb_caocl2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли",
    "firstPage": 118
  },
  "tb_of2": {
    "grades": [
      7,
      8
    ],
    "chapter": "прочее",
    "firstPage": 106
  },
  "tb_ko3": {
    "grades": [
      7
    ],
    "chapter": "прочее",
    "firstPage": 103
  },
  "tb_br2o7": {
    "grades": [
      8
    ],
    "chapter": "оксиды",
    "firstPage": 22
  },
  "tb_feco5": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 158
  },
  "tb_fe3c": {
    "grades": [
      9
    ],
    "chapter": "прочее",
    "firstPage": 159
  },
  "tb_kfefecn6": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 161
  },
  "tb_fe3fecn62": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 202
  },
  "tb_fe4fecn63": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 202
  },
  "tb_scoh3": {
    "grades": [
      11
    ],
    "chapter": "основания",
    "firstPage": 10
  },
  "tb_sc2o3": {
    "grades": [
      11
    ],
    "chapter": "оксиды",
    "firstPage": 10
  },
  "tb_p4s7": {
    "grades": [
      11
    ],
    "chapter": "прочее",
    "firstPage": 134
  },
  "tb_ch3coona": {
    "grades": [
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 46
  },
  "tb_c2h5ona": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 14
  },
  "tb_c6h5ona": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 125
  },
  "tb_c17h35coona": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 153
  },
  "tb_ch3coo2ca": {
    "grades": [
      10,
      11
    ],
    "chapter": "соли",
    "firstPage": 138
  },
  "tb_c2h5coona": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 46
  },
  "tb_ch3ch2ch2coona": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 141
  },
  "tb_ch3coo2mg": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 142
  },
  "tb_ch3cook": {
    "grades": [
      11
    ],
    "chapter": "соли",
    "firstPage": 54
  },
  "tb_nh4ncs": {
    "grades": [
      9
    ],
    "chapter": "соли",
    "firstPage": 162
  },
  "tb_cu3co32oh2": {
    "grades": [
      7
    ],
    "chapter": "соли",
    "firstPage": 108
  },
  "tb_hcoona": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 112
  },
  "tb_naoch2ch2ona": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 119
  },
  "tb_c3h5ona3": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 120
  },
  "tb_feoc6h53": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 126
  },
  "tb_c6h5so3na": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 127
  },
  "tb_c6h5ok": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 129
  },
  "tb_c15h31coona": {
    "grades": [
      10
    ],
    "chapter": "соли",
    "firstPage": 155
  }
} as const

/** Органические молекулы (id из ORGANIC_MOLECULES): классы учебников, где молекула упоминается. */
export const ORGANIC_GRADE_MAP: Readonly<Record<string, OrganicGradeEntry>> = {
  "sucrose": {
    "grades": [
      7,
      9,
      10,
      11
    ],
    "firstPage": 12
  },
  "ethanol": {
    "grades": [
      7,
      9,
      10,
      11
    ],
    "firstPage": 12
  },
  "dimethyl-ether": {
    "grades": [
      7,
      9,
      10,
      11
    ],
    "firstPage": 12
  },
  "acetic-acid": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "firstPage": 34
  },
  "ethane": {
    "grades": [
      7,
      9,
      10,
      11
    ],
    "firstPage": 53
  },
  "glucose-open": {
    "grades": [
      7,
      9,
      10
    ],
    "firstPage": 54
  },
  "glucose-pyranose": {
    "grades": [
      7,
      9,
      10
    ],
    "firstPage": 54
  },
  "fructose": {
    "grades": [
      7,
      9,
      10
    ],
    "firstPage": 54
  },
  "methane": {
    "grades": [
      7,
      8,
      9,
      10,
      11
    ],
    "firstPage": 63
  },
  "methanol": {
    "grades": [
      7,
      9,
      10,
      11
    ],
    "firstPage": 88
  },
  "propane": {
    "grades": [
      7,
      9,
      10,
      11
    ],
    "firstPage": 108
  },
  "formaldehyde": {
    "grades": [
      7,
      10
    ],
    "firstPage": 118
  },
  "formic-acid": {
    "grades": [
      7,
      10,
      11
    ],
    "firstPage": 119
  },
  "phenol": {
    "grades": [
      7,
      10
    ],
    "firstPage": 145
  },
  "glycerol": {
    "grades": [
      7,
      10
    ],
    "firstPage": 154
  },
  "acetylene": {
    "grades": [
      8,
      9,
      10,
      11
    ],
    "firstPage": 11
  },
  "acetone": {
    "grades": [
      8,
      9,
      10
    ],
    "firstPage": 94
  },
  "benzene": {
    "grades": [
      8,
      9,
      10
    ],
    "firstPage": 94
  },
  "toluene": {
    "grades": [
      9,
      10
    ],
    "firstPage": 81
  },
  "n-butane": {
    "grades": [
      9,
      10
    ],
    "firstPage": 179
  },
  "isobutane": {
    "grades": [
      9,
      10
    ],
    "firstPage": 179
  },
  "ethyl-acetate": {
    "grades": [
      9,
      10
    ],
    "firstPage": 187
  },
  "styrene": {
    "grades": [
      9,
      10
    ],
    "firstPage": 187
  },
  "acetaldehyde": {
    "grades": [
      9,
      10
    ],
    "firstPage": 187
  },
  "ethylene": {
    "grades": [
      9,
      10,
      11
    ],
    "firstPage": 190
  },
  "aniline": {
    "grades": [
      10
    ],
    "firstPage": 8
  },
  "chloroethane": {
    "grades": [
      10
    ],
    "firstPage": 14
  },
  "methylamine": {
    "grades": [
      10
    ],
    "firstPage": 14
  },
  "n-butanol": {
    "grades": [
      10
    ],
    "firstPage": 14
  },
  "diethyl-ether": {
    "grades": [
      10
    ],
    "firstPage": 14
  },
  "chloromethane": {
    "grades": [
      10
    ],
    "firstPage": 17
  },
  "ethylene-glycol": {
    "grades": [
      10
    ],
    "firstPage": 17
  },
  "n-pentane": {
    "grades": [
      10
    ],
    "firstPage": 18
  },
  "isopentane": {
    "grades": [
      10
    ],
    "firstPage": 18
  },
  "butadiene": {
    "grades": [
      10
    ],
    "firstPage": 18
  },
  "propene": {
    "grades": [
      10
    ],
    "firstPage": 19
  },
  "cyclopropane": {
    "grades": [
      10
    ],
    "firstPage": 19
  },
  "propanol": {
    "grades": [
      10
    ],
    "firstPage": 20
  },
  "n-hexane": {
    "grades": [
      10
    ],
    "firstPage": 21
  },
  "2-methylpentane": {
    "grades": [
      10
    ],
    "firstPage": 21
  },
  "3-methylpentane": {
    "grades": [
      10
    ],
    "firstPage": 21
  },
  "2-3-dimethylbutane": {
    "grades": [
      10
    ],
    "firstPage": 21
  },
  "2-2-dimethylbutane": {
    "grades": [
      10
    ],
    "firstPage": 21
  },
  "cyclobutane": {
    "grades": [
      10
    ],
    "firstPage": 23
  },
  "neopentane": {
    "grades": [
      10
    ],
    "firstPage": 27
  },
  "cyclopentane": {
    "grades": [
      10
    ],
    "firstPage": 27
  },
  "cyclohexane": {
    "grades": [
      10
    ],
    "firstPage": 47
  },
  "isoprene": {
    "grades": [
      10
    ],
    "firstPage": 64
  },
  "propyne": {
    "grades": [
      10
    ],
    "firstPage": 67
  }
} as const
