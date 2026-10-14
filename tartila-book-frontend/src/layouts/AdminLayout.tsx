import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
    { to: '/admin', label: 'Buku & ebook', end: true },
    { to: '/admin/mitra/buku', label: 'Ebook mitra' },
    { to: '/admin/mitra', label: 'Mitra', end: true },
    { to: '/admin/pilihan', label: 'Taksonomi' },
    { to: '/admin/langganan', label: 'Paket langganan' },
    { to: '/admin/akses', label: 'Jadwal buka / kunci' },
    { to: '/admin/pembayaran', label: 'Pembayaran' },
    { to: '/admin/royalti', label: 'Royalti & pengaturan' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
            ? 'bg-forest-moss-100 font-semibold text-oxford-navy-700'
            : 'font-medium text-oxford-navy-900/80 hover:bg-forest-moss-50'
    }`;

/** Panel admin Tartila Book: menu samping + isi. */
export default function AdminLayout() {
    return (
        <div className="mx-auto grid max-w-[1232px] grid-cols-1 gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[14rem_1fr]">
            <aside
                aria-label="Menu admin"
                className="card-shadow h-fit rounded-2xl bg-white p-3 ring-1 ring-forest-moss-100"
            >
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-oxford-navy-900/55">
                    Panel admin
                </p>
                <nav className="flex gap-1 overflow-x-auto lg:flex-col">
                    {LINKS.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            className={linkClass}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </nav>
            </aside>
            <section className="card-shadow min-w-0 rounded-2xl bg-white p-5 ring-1 ring-forest-moss-100 sm:p-6">
                <Outlet />
            </section>
        </div>
    );
}
