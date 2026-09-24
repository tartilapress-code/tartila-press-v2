/** Menggulir halus ke elemen ber-`id` tertentu (dipakai navigasi samping). */
export function scrollToSection(id: string) {
    document
        .getElementById(id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
