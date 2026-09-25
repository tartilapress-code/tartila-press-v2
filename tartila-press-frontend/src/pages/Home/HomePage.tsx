import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();

    return (
        <>
            <HeroSection />

            <Wrapper id="layanan">
                <Title
                    subtitle={t('home.sections.services.subtitle')}
                    action={{
                        to: '/layanan',
                        label: t('home.sections.services.all'),
                    }}
                >
                    {t('home.sections.services.title')}
                </Title>
                <Services />
            </Wrapper>

            <Wrapper id="paket" tone="tint">
                <Title
                    subtitle={t('home.sections.packages.subtitle')}
                    action={{
                        to: '/paket',
                        label: t('home.sections.packages.all'),
                    }}
                >
                    {t('home.sections.packages.title')}
                </Title>
                <HomePackages />
            </Wrapper>

            <Wrapper id="katalog">
                <Title
                    action={{
                        to: '/buku',
                        label: t('home.sections.books.all'),
                    }}
                >
                    {t('home.sections.books.title')}
                </Title>
                <BookCatalogHome />
            </Wrapper>

            <Wrapper id="penulis" tone="tint">
                <Title
                    action={{
                        to: '/penulis',
                        label: t('home.sections.authors.all'),
                    }}
                >
                    {t('home.sections.authors.title')}
                </Title>
                <PeopleDirectory role="penulis" limit={4} />
            </Wrapper>

            <Wrapper id="editor">
                <Title
                    action={{
                        to: '/editor',
                        label: t('home.sections.editors.all'),
                    }}
                >
                    {t('home.sections.editors.title')}
                </Title>
                <PeopleDirectory role="editor" limit={4} />
            </Wrapper>

            <Wrapper id="artikel" tone="tint">
                <Title
                    subtitle={t('home.sections.articles.subtitle')}
                    action={{
                        to: '/artikel',
                        label: t('home.sections.articles.all'),
                    }}
                >
                    {t('home.sections.articles.title')}
                </Title>
                <Information />
            </Wrapper>

            <Wrapper id="event">
                <Title
                    action={{
                        to: '/event',
                        label: t('home.sections.events.all'),
                    }}
                >
                    {t('home.sections.events.title')}
                </Title>
                <Event />
            </Wrapper>

            <div className="fixed bottom-5 right-10 z-40">
                <Top />
            </div>
        </>
    );
}
