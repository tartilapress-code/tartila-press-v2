import PeopleDirectory from '@/components/people/PeopleDirectory';

export default function PenulisListPage() {
    return (
        <div className="flex flex-col gap-6 my-10">
            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-oxford-navy-900 text-3xl font-bold">
                    Penulis Kami
                </h1>
                <p className="text-oxford-navy-900/70">
                    Kenali para penulis yang berkarya bersama Tartila Press.
                </p>
            </div>

            <PeopleDirectory role="penulis" />
        </div>
    );
}
