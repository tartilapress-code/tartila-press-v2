import logo from '../assets/logo/logo.png';
import slogan from '../data/slogan.json';

const sizes = {
    small: 'size-10',
    medium: 'size-15',
    large: 'size-20 ',
};

type LogoProps = {
    size?: 'small' | 'medium' | 'large';
};

export default function Logo({ size = 'medium' }: LogoProps): React.ReactNode {
    const alt: string = 'Logo';

    return (
        <>
            <div className="py-2 flex flex-row gap-4 items-center">
                <div
                    className={`rounded-xl bg-white flex items-center justify-center overflow-hidden ${sizes[size]} `}
                >
                    <img
                        src={logo}
                        alt={alt}
                        className="h-full w-auto object-cover"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <h6 className="text-base font-semibold text-white">
                        {slogan.name}
                    </h6>
                    <p className="text-sm font-light text-white">
                        {slogan.slogan}
                    </p>
                </div>
            </div>
        </>
    );
}
