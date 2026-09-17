import React from 'react';

function Map(): React.JSX.Element {
    return (
        <div className="map">
            <img
                loading="lazy"
                src="https://originalmap.co.uk/wp-content/uploads/2019/08/World_Map_Planisphere_World_Map_Geography-2.jpg"
                alt="Lazy loaded content"
            />
        </div>
    );
}

export default Map;