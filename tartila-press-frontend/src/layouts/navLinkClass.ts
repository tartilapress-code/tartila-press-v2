export const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
        isActive
            ? 'bg-forest-moss-100 font-semibold text-oxford-navy-700'
            : 'text-oxford-navy-900/80 hover:bg-forest-moss-50 hover:text-oxford-navy-700'
    }`;
