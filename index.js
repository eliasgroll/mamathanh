const fetch = require('cross-fetch');
const express = require('express');
const mail = require('@sendgrid/mail');
const contacts = require('@sendgrid/client');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
// in latest body-parser use like below.
app.use(bodyParser.urlencoded({extended: true}));
const port = 3000;
const THIRTY_MINUTES = 60 * 1000 * 30;
let placesData = {};
const GPLACE_ID = 'ChIJszx8xfQMl0cRT2u02_0_K94';
const GPLACES_KEY = 'AIzaSyCRPFAqXzH1w4oYxkN73urCJKgNWikOQ9c';
const SENDGRID_API_KEY = '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';
const SENDER_EMAIL = 'team@duy-restaurant.de';
mail.setApiKey(SENDGRID_API_KEY);
contacts.setApiKey(SENDGRID_API_KEY);
const log = (s) => {
    console.log(new Date() + ': ' + s);
}
const getGooglePlaceData = async () => {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.append('place_id', GPLACE_ID)
    url.searchParams.append('key', GPLACES_KEY)
    url.searchParams.append('language', 'de_DE');

    return fetch(url)
        .then(res => res.json()).then(r => r.result)
}

// Serve files from the 'public' folder
app.use(express.static('public'));

app.get('/api/places', (req, res) => {
    res.status(200).send(placesData);
});

app.get('/api/view', (req, res) => {

    res.end(200);
});

app.post('/api/book', bodyParser.urlencoded({ extended: true }), async (req, res) => {
    const {email, name, numPeople, Date} = req.body;
    console.log(req);
    await mail.send(newEmail(email, name, numPeople, Date))
    await contacts.request({
        url: '/v3/marketing/contacts',
        method: 'PUT',
        body: {'list_ids': ['All Contacts'], 'contacts': [{email}]},
    });
    res.end(200);
})

const newEmail = (email, name, numPeople, Date) => {
    const mail = {
        to: [email],
        from: SENDER_EMAIL,
        cc: ['team@restaurant-duy.de'],
        subject: `Deine Reservierung bei Duy für ${numPeople} Personen am ${Date}.`,
        text: `Vielen Dank für deine Reservierung bei Duy's Restaurant für ${numPeople} Personen! 
                Wir schicken dir bald eine Bestätigung.`
    }
    console.log(mail);
    return mail;
}

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

