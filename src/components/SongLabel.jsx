import { passageTitle, songNumbers } from '../core/tanakhSongs.js';
import { t } from '../i18n/locale.js';

export default function SongLabel({ song }) {
    return <>{passageTitle(song)} · {t(song.book)} <bdi dir="ltr">{songNumbers(song)}</bdi></>;
}
