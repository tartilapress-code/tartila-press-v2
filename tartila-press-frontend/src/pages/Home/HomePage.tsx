import Event from '@/components/Event';
import HeroSection from '@/components/header/Header';
import Information from '@/components/Information';
import Services from '@/components/Services';
import Title from '@/components/Tittle';
import Wrapper from '@/components/Wrapper';
import BookCatalogHome from '@/components/book/BookCatalogHome';
import HomePackages from '@/components/package/HomePackages';
import Top from '@/components/Top';
import PeopleDirectory from '@/components/people/PeopleDirectory';

export default function Home() {
    return (
        <>
            <HeroSection />

            <Wrapper id="layanan">
                <Title
                    subtitle="Dari naskah sampai buku terbit, kami dampingi setiap tahapnya."
                    action={{ to: '/layanan', label: 'Lihat semua layanan' }}
                >
                    Layanan Kami
                </Title>
                <Services />
            </Wrapper>

            <Wrapper id="paket" tone="tint">
                <Title
                    subtitle="Pilih paket yang sesuai dengan kebutuhan penerbitan Anda."
                    action={{ to: '/paket', label: 'Lihat semua paket' }}
                >
                    Paket Penerbitan
                </Title>
                <HomePackages />
            </Wrapper>

            <Wrapper id="katalog">
                <Title action={{ to: '/buku', label: 'Lihat semua buku' }}>
                    Katalog Buku
                </Title>
                <BookCatalogHome />
            </Wrapper>

            <Wrapper id="penulis" tone="tint">
                <Title
                    action={{ to: '/penulis', label: 'Lihat semua penulis' }}
                >
                    Penulis Kami
                </Title>
                <PeopleDirectory role="penulis" limit={4} />
            </Wrapper>

            <Wrapper id="editor">
                <Title action={{ to: '/editor', label: 'Lihat semua editor' }}>
                    Editor Kami
                </Title>
                <PeopleDirectory role="editor" limit={4} />
            </Wrapper>

            <Wrapper id="artikel" tone="tint">
                <Title
                    subtitle="Wawasan dan cerita dari komunitas penulis Tartila Press."
                    action={{ to: '/artikel', label: 'Lihat semua artikel' }}
                >
                    Artikel
                </Title>
                <Information />
            </Wrapper>

            <Wrapper id="event">
                <Title action={{ to: '/event', label: 'Lihat semua event' }}>
                    Event
                </Title>
                <Event />
            </Wrapper>

            <div className="fixed bottom-5 right-10 z-40">
                <Top />
            </div>
        </>
    );
}
