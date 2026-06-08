# Интерактивные дашборды (cyber)

## Файлы для §

| Файл | Назначение |
|------|------------|
| `topic_g7_c1_s01.webp` | Базовое разрешение (~1536 px) |
| `topic_g7_c1_s01@2x.webp` | Retina / большие экраны (~2048 px) |
| `topic_g7_c1_s01_source.png` | Исходник для перегенерации |

Имя: `topic_{grade}_{chapter}_{section}.webp`

## Идеальное качество (4K)

Замените `*_source.png` на **3840×2160** и выполните из корня репозитория:

```bash
node -e "
import sharp from 'sharp';
const src = 'public/learn/dashboard/topic_g7_c1_s01_source.png';
await sharp(src).resize(3840).webp({quality:92}).toFile('public/learn/dashboard/topic_g7_c1_s01@2x.webp');
await sharp(src).resize(1920).webp({quality:90}).toFile('public/learn/dashboard/topic_g7_c1_s01.webp');
"
```

Подробнее: `docs/LEARN_CYBER_DASHBOARD.md`
