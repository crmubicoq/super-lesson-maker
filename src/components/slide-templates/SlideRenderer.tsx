import { Slide } from '@/types/slide';
import CoverSlide from './CoverSlide';
import TitleBodySlide from './TitleBodySlide';
import BulletListSlide from './BulletListSlide';
import Grid2x2Slide from './Grid2x2Slide';
import Grid1x3Slide from './Grid1x3Slide';
import ContentImageSlide from './ContentImageSlide';
import ImageBackgroundSlide from './ImageBackgroundSlide';
import SectionDividerSlide from './SectionDividerSlide';

export interface SlideTemplateProps {
    slide: Slide;
    slideIndex: number;
    totalSlides: number;
}

export default function SlideRenderer({ slide, slideIndex, totalSlides }: SlideTemplateProps) {
    const commonProps = { slide, slideIndex, totalSlides };

    switch (slide.layout) {
        case 'cover':
            return <CoverSlide {...commonProps} />;
        case 'title_body':
            return <TitleBodySlide {...commonProps} />;
        case 'bullet_list':
            return <BulletListSlide {...commonProps} />;
        case 'grid_2x2':
            return <Grid2x2Slide {...commonProps} />;
        case 'grid_1x3':
            return <Grid1x3Slide {...commonProps} />;
        case 'content_image':
            return <ContentImageSlide {...commonProps} />;
        case 'image_background':
            return <ImageBackgroundSlide {...commonProps} />;
        case 'section_divider':
            return <SectionDividerSlide {...commonProps} />;
        default:
            return <BulletListSlide {...commonProps} />;
    }
}
