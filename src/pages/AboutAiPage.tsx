/**
 * «Об ИИ-учителе» (#/about-ai): что умеет, где ошибается, что хранится и сколько, кто отвечает — ru/uz/en.
 * Информирование пользователя по Правилам этики ИИ № 3787 и ЗРУ-547 (docs/COMPLIANCE.md). Текст — aboutAiContent.ts.
 */
import { useEffect } from 'react'
import { useLocale } from '../i18n/useLocale'
import { AI_CONTACT_URL, aboutAiContent } from './aboutAiContent'
import styles from './AboutAiPage.module.css'

export function AboutAiPage() {
  const { locale } = useLocale()
  const c = aboutAiContent(locale)

  useEffect(() => {
    const prev = document.title
    document.title = `${c.title} · ATOMLAB`
    return () => {
      document.title = prev
    }
  }, [c.title])

  return (
    <main className={styles.page} data-about-ai="">
      <article className={styles.inner} lang={locale === 'uz' ? 'uz' : locale === 'en' ? 'en' : 'ru'}>
        <a className={styles.back} href="#/learn">
          ← {c.back}
        </a>
        <header className={styles.head}>
          <h1 className={styles.title}>{c.title}</h1>
          <p className={styles.lead}>{c.lead}</p>
        </header>

        {c.sections.map((s) => (
          <section key={s.id} className={styles.section} aria-labelledby={`about-ai-${s.id}`}>
            <h2 id={`about-ai-${s.id}`} className={styles.h2}>
              {s.title}
            </h2>
            {s.text ? <p className={styles.p}>{s.text}</p> : null}
            {s.items ? (
              <ul className={styles.list}>
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <section className={styles.section} aria-labelledby="about-ai-storage">
          <h2 id="about-ai-storage" className={styles.h2}>
            {c.storageTitle}
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {c.storageHead.map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.storage.map((r) => (
                  <tr key={r.what}>
                    <th scope="row">{r.what}</th>
                    <td>{r.where}</td>
                    <td>{r.howLong}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="about-ai-contact">
          <h2 id="about-ai-contact" className={styles.h2}>
            {c.contactTitle}
          </h2>
          {c.contact.map((p) => (
            <p key={p} className={styles.p}>
              {p}
            </p>
          ))}
          <p className={styles.p}>
            <a className={styles.link} href={AI_CONTACT_URL} target="_blank" rel="noreferrer">
              {c.contactLink}
            </a>
          </p>
        </section>

        <section className={styles.section} aria-labelledby="about-ai-laws">
          <h2 id="about-ai-laws" className={styles.h2}>
            {c.lawsTitle}
          </h2>
          <ul className={styles.list}>
            {c.laws.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className={styles.updated}>{c.updated}</p>
        </section>
      </article>
    </main>
  )
}
