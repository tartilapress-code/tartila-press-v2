import logo from '../assets/logo/logo.png';
import articles from '../data/articles.json';
import Badge from './Badge';
import Button from './Button/Button';

export default function InformationCard() {
    const alt: string = 'Writer';

    return (
        <>
            {articles.map((article) => (
                <div
                    key={article.id}
                    className="flex flex-col w-full h-full bg-forest-moss-500 rounded-xl
                    transition-transform hover:-translate-y-2 duration-200
                    "
                >
                    <div
                        className="
                        bg-[url(../assets/images/buku.png)] h-40 w-full rounded-md bg-cover bg-no-repeat bg-center
                        "
                    >
                        <div className="p-4">
                            <Badge variant="secondary">{article.type}</Badge>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-3 w-full p-4">
                        <small className="text-white">
                            {article.read_duration}
                            <span className="font-semibold"> read</span>
                        </small>
                        <h4 className="text-white font-extrabold text-sm">
                            {article.title}
                        </h4>
                        <p className="text-white line-clamp-2 font-light text-sm">
                            {article.description}
                        </p>
                        <div className="flex flex-row justify-between  justify-self-end mt-auto">
                            <div className="flex flex-row gap-2 items-center">
                                <img
                                    src={logo}
                                    alt={alt}
                                    className="bg-white size-10 object-contain rounded-full"
                                />
                                <div className="flex flex-col text-white justify-center">
                                    <h5 className="text-base font-bold">
                                        {article.writer}
                                    </h5>
                                    <p className="text-xs font-light">
                                        {article.created_at}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <Button variant="white">Read</Button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
}
