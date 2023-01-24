const fetch = require('cross-fetch');
const express = require('express');
const app = express();
const port = 3000;
const THIRTY_MINUTES = 60*1000*30;
let placesData = {};
const log = (s) => {
    console.log(new Date() + ': ' + s);
}
const getGooglePlaceData = async () => {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.append('place_id', 'ChIJszx8xfQMl0cRT2u02_0_K94')
    url.searchParams.append('key', 'AIzaSyBL9pVe61LKssUfkAXnJjrOcdJXmyHNJIs')
    url.searchParams.append('language', 'de_DE');

    return fetch(url)
        .then(res => res.json()).then(r => r.result)
}

// Serve files from the 'public' folder
app.use(express.static('public'));

app.get('/api/places', (req, res) => {
    res.status(200).send(placesData);
});

(async () => {
        placesData = await getGooglePlaceData();
        log('Got data from Google Places API');
        setInterval(async () => {
            placesData = await getGooglePlaceData();
            log('Updated data from Google Places API');
        }, THIRTY_MINUTES);
        app.listen(port, () => {
            log(`Server listening on port ${port}`);
        });
    }
)();

