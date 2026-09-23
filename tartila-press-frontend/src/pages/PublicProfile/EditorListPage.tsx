import PeopleDirectory from '@/components/people/PeopleDirectory';

export default function EditorListPage() {
    return (
        <div className="flex flex-col gap-6 my-10">
            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-oxford-navy-900 text-3xl font-bold">
                    Editor Kami
                </h1>
                <p className="text-oxford-navy-900/70">
                    Tim editor profesional yang siap membantu naskah Anda.
                </p>
            </div>

            <PeopleDirectory role="editor" />
        </div>
    );
}
