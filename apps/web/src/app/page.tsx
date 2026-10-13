import './landing.css';
import { LANDING_HTML } from './landing-html';

/** Marketing site, generated from the design canvas. Links point to the app download section. */
export default function Landing() {
  return <div dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />;
}
