// ID video YouTube selalu 11 karakter (huruf, angka, "_" dan "-").
const YOUTUBE_ID_PATTERN =
    /(?:youtu\.be\/|youtube\.com\/(?:embed|live|shorts)\/|youtube\.com\/watch\?(?:[^#\s]*&)?v=)([\w-]{11})/;

/**
 * Ubah link YouTube (watch, youtu.be, embed, live, shorts) jadi URL embed
 * untuk <iframe>. Mengembalikan null bila bukan link video YouTube.
 */
export function youtubeEmbedUrl(url: string): string | null {
    const match = url.match(YOUTUBE_ID_PATTERN);

    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}
