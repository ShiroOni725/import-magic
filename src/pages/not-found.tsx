import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="not-found reveal" data-testid="page-not-found">
      <div className="not-found-icon"><Compass size={28} /></div>
      <div className="eyebrow">wrong turn · cabinet 404</div>
      <h1>The secret<br /><em>level is elsewhere.</em></h1>
      <p>This corner of the arcade is still being painted. Head back to the foyer and pick a better door.</p>
      <Link className="primary-button" href="/" data-testid="link-not-found-home"><ArrowLeft size={15} /> back to the arcade</Link>
    </div>
  );
}