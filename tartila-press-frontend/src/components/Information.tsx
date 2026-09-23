import Badge from './Badge';
import Button from './Button/Button';
import InformationCard from './InformationCard';

export default function Information() {
    return (
        <>
            <div
                className="h-auto w-auto
                bg-[url(../assets/images/buku.png)] bg-center bg-no-repeat bg-cover rounded-xl relative
                "
            >
                <div className="bg-oxford-navy-950/90 w-full inset-0 h-full grid grid-cols-2 auto-cols-fr gap-4 p-4 rounded-xl">
                    <div className="grid grid-rows-2 auto-cols-fr gap-4">
                        <div className="flex flex-col w-full p-4 gap-6 m-0">
                            <h1
                                className="
                                text-5xl font-bold text-forest-moss-400 z-100 leading-15 text-shadow-white/80 text-shadow-xs"
                            >
                                Stay Inform and Inspired with Our Publisher
                            </h1>
                        </div>
                        <div
                            className="p-4 w-full h-auto flex flex-col gap-4 justify-end
                            bg-[url(../assets/images/buku.png)] bg-center bg-no-repeat bg-cover rounded-xl
                            transition-transform hover:-translate-y-2 duration-200
                            "
                        >
                            <div className="mb-auto justify-self-start">
                                <Badge variant="secondary">Publishing</Badge>
                            </div>
                            <div
                                className="flex w-1/2 flex-col gap-6
                                "
                            >
                                <h4 className="font-extrabold text-3xl text-white text-shadow-black/50 text-shadow-lg">
                                    New Article Await Read Our newest Articles
                                </h4>
                                <Button variant="primary">
                                    Checks Articles
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 auto-rows-fr gap-4 w-auto h-auto">
                        <InformationCard />
                    </div>
                </div>
            </div>
        </>
    );
}
