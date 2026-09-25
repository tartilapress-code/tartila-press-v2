import { useTranslation } from 'react-i18next';

export default function Copyrights() {
    const { t } = useTranslation();

    return (
        <>
            <div className="mt-8 border-t border-forest-moss-200 pt-5 text-center">
                <small className="text-sm text-oxford-navy-900/60">
                    {t('footer.copyright', {
                        name: t('common.brand.name'),
                        slogan: t('common.brand.slogan'),
                    })}
                </small>
            </div>
        </>
    );
}
