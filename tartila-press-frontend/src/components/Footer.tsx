import socialMedia from '../data/footer-social-media.json';
import contacts from '../data/footer-kontak.json';
import Copyrights from './Copyrights';

export default function Footer() {
    return (
        <>
            <footer id="kontak" className="bg-oxford-navy-900 text-white p-6">
                <div className="container py-5">
                    <div
                        className="
                            lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1 lg:gap-x-4
                            sm:flex sm:flex-col sm:gap-y-4
                            flex flex-col gap-y-4
                            "
                    >
                        <div
                            className="
                                lg:gap-4 lg:mr-20
                                sm:gap-2
                                flex flex-col gap-2
                                "
                        >
                            <h4 className="font-bold">Tartila Press</h4>
                            <p className="text-[#d6d6d6] text-base/relaxed">
                                Penerbit independen yang berfokus pada
                                penerbitan buku berkualitas, pengembangan
                                literasi, dan distribusi karya penulis Indonesia
                                secara profesional.
                            </p>
                        </div>

                        <div
                            className="
                                lg:gap-4
                                sm:gap-2
                                flex flex-col gap-2
                                "
                        >
                            <h4 className="font-bold">Kontak</h4>

                            <div className="flex flex-col gap-1">
                                {contacts.map((kontak) => (
                                    <div className="flex flex-row items-center gap-2">
                                        <i className={kontak.icon}></i>
                                        <p className="m-0">{kontak.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div
                            className="
                                lg:gap-4
                                sm:gap-2
                                flex flex-col gap-2
                                "
                        >
                            <h4 className="font-bold">Sosial Media</h4>

                            <div className="flex flex-col gap-1">
                                {socialMedia.map((media) => (
                                    <div
                                        key={media.id}
                                        className="flex gap-2 items-center"
                                    >
                                        <i
                                            className={`text-xl ${media.icon}`}
                                        ></i>
                                        <a
                                            href="https://instagram.com"
                                            target="_blank"
                                            className="
                                            text-white no-underline
                                            footer-hover
                                            "
                                        >
                                            {media.name}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <Copyrights />
            </footer>
        </>
    );
}
