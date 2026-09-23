import Card2Flip from '@/components/card/flipcard/Card2Flip';
import Event from '@/components/Event';
import HeroSection from '@/components/header/Header';
import Information from '@/components/Information';
import Services from '@/components/Services';
import Title from '@/components/Tittle';
import Wrapper from '@/components/Wrapper';
import BookCatalogHome from '@/components/book/BookCatalogHome';
import Top from '@/components/Top';
import PeopleDirectory from '@/components/people/PeopleDirectory';

export default function Home() {
    return (
        <>
            <HeroSection />

            <Wrapper id="layanan">
                <Title>Layanan Kami</Title>
                <Services />
            </Wrapper>

            <Wrapper id="paket">
                <Title>Paket Penerbitan</Title>
                <Card2Flip />
            </Wrapper>

            <Wrapper id="katalog">
                <Title>Books Catalog</Title>
                <BookCatalogHome />
            </Wrapper>

            <Wrapper id="penulis">
                <Title>Penulis Kami</Title>
                <PeopleDirectory role="penulis" limit={4} />
            </Wrapper>

            <Wrapper id="editor">
                <Title>Editor Kami</Title>
                <PeopleDirectory role="editor" limit={4} />
            </Wrapper>

            <Wrapper id="artikel">
                <Title>Articles</Title>
                <Information />
            </Wrapper>

            <Wrapper id="event">
                <Title>Event</Title>
                <Event />
            </Wrapper>

            <div className="fixed bottom-5 right-10">
                <Top />
            </div>
        </>
    );
}
