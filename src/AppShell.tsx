import { NavLink, Outlet } from 'react-router-dom'
import styles from './AppShell.module.css'

export function AppShell() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo} end>
          ATOMLAB
        </NavLink>
        <nav className={styles.nav}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Лаборатория
          </NavLink>
          <NavLink
            to="/periodic"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Таблица Менделеева
          </NavLink>
          <NavLink
            to="/catalog"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Каталог веществ
          </NavLink>
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
