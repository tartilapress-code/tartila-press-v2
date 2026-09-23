import { NavHashLink } from 'react-router-hash-link';
import hero from '../../../data/hero.json';
import type React from 'react';
import Button from '@/components/Button/Button';

type HeroProps = {
    children?: React.ReactNode;
};

export default function Hero({ children }: HeroProps): React.ReactNode {
    return (
        <>
            <div
                id="home"
                className="
                relative flex flex-col
                bg-[url(../assets/images/buku.png)] bg-cover bg-center bg-no-repeat h-dvh
                 justify-center scroll-mt-30 p-6
                "
            >
                <div className="absolute inset-0 bg-oxford-navy-900/70 w-full h-full "></div>
                <div className="z-200 sticky top-0 self-start mb-auto w-full">
                    {children}
                </div>

                <div
                    className="
                    lg:w-1/2
                    md:gap-15
                    flex flex-col gap-15 w-full h-fit z-100 justify-self-center mb-20
                    "
                >
                    <div className="flex flex-col gap-6">
                        <h1 className="text-5xl leading-14 text-white font-semibold text-shadow-lg ">
                            {hero.headline}
                        </h1>
                        <p className="text-base font-medium text-white text-shadow-lg ">
                            {hero.subheadline}
                        </p>
                    </div>

                    <div className="flex flex-row w-fit gap-4">
                        <NavHashLink to="#paket" smooth>
                            <Button variant="primary">Lihat Paket</Button>
                        </NavHashLink>
                        <NavHashLink to="https://wa.me/6283180773955">
                            <Button variant="outline2">Konsultasi</Button>
                        </NavHashLink>
                    </div>
                </div>
            </div>
        </>
    );
}
