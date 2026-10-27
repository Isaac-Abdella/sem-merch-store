import { Link, useLocation } from 'react-router-dom';
import ServiceAreaMap from '../components/map/ServiceAreaMap';

/** Used both as the "sorry, too far" page and the general /delivery-area info page. */
export default function OutOfServiceArea() {
  const { state } = useLocation();
  const rejected = state?.distanceKm != null;

  return (
    <div className="container narrow">
      {rejected ? (
        <>
          <h1>We don't deliver there yet</h1>
          <p>
            {state.message ||
              `That address is about ${Math.round(state.distanceKm)} km from downtown Toronto, outside our 25 km delivery area.`}
          </p>
        </>
      ) : (
        <>
          <h1>Our delivery area</h1>
          <p>We deliver anywhere within 25 km of downtown Toronto — that includes the old city, North York, Etobicoke, Scarborough, and nearby parts of Mississauga, Vaughan and Markham.</p>
        </>
      )}
      <ServiceAreaMap height={420} />
      <p>
        <Link to="/">← Back to the shop</Link>
      </p>
    </div>
  );
}
