const fetch = require('cross-fetch');
const express = require('express');
const mail = require('@sendgrid/mail');
const bodyParser = require('body-parser');
const compression = require('compression');
const multer = require('multer');

const THIRTY_MINUTES = 60 * 1000 * 30;
const PORT = 3000;
const CONFIRM_KEY = '98mzwqerfc9m8cwef';
const MAIL_PARAMS = ['email', 'name', 'numPeople', 'date'];
const HOST = 'https://restaurant-duy.de';

const app = express();
app.use(compression());
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));

const upload = multer({dest: 'uploads/'});

const SENDGRID_API_KEY = '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';
const RESTAURANT_EMAIL = 'team@duy-restaurant.de'
const SENDGRID_RESERVATION = 'd-4d99aca202ef403bb71d6ca6c155890b';
const SENDGRID_CONFIRMATION = 'd-720d108a9b0248a28438b524656f98ba';
mail.setApiKey(SENDGRID_API_KEY);
const contacts = require('@sendgrid/client');
const {raw} = require("body-parser");
contacts.setApiKey(SENDGRID_API_KEY);

const GPLACE_ID = 'ChIJszx8xfQMl0cRT2u02_0_K94';
const GPLACES_KEY = 'AIzaSyCRPFAqXzH1w4oYxkN73urCJKgNWikOQ9c';
const getGooglePlaceData = async () => {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.append('place_id', GPLACE_ID)
    url.searchParams.append('key', GPLACES_KEY)
    url.searchParams.append('language', 'de_DE');

    return fetch(url)
        .then(res => res.json()).then(r => r.result)
}

const log = (s) => {
    console.log(new Date() + ': ' + s);
}

// Middlewares
/**
 * @param required {string[]}
 */
const checkFormFields = (required) => {
    return (req, res, next) => {
        for (const param of required) {
            if (req.body[param] === undefined) {
                return res.status(400).json({
                    error: `Missing form field '${param}.'`
                });
            }
        }
        next();
    }
}
const checkParams = (required) => {
    return (req, res, next) => {
        for (const param of required) {
            if (req.query[param] === undefined) {
                return res.status(400).json({
                    error: `Missing parameter '${param}.'`
                });
            }
        }
        next();
    }
}

const checkKey = (req, res, next) => {
    if (req.query?.key !== CONFIRM_KEY) {
        return res.status(400).json({
            error: 'Invalid key.'
        });
    }
    next();
}

// Mail templates
const confirmation = (params) => {
    const {email, name, numPeople, date} = params;
    return {
        from: RESTAURANT_EMAIL,
        template_id: SENDGRID_CONFIRMATION,
        personalizations: [{
            to: {email},
            cc: [RESTAURANT_EMAIL],
            dynamic_template_data: {
                name, numPeople, date
            },
        }],
    };
}

const clientReservation = (params) => {
    const {email, name, numPeople, date} = params;
    return {
        from: RESTAURANT_EMAIL,
        template_id: SENDGRID_RESERVATION,
        personalizations: [{
            to: {email},
            dynamic_template_data: {
                name, numPeople, date
            },
        }],
    };
}

const tr = (name, value) => `<tr  style="border: 1px solid black; border-collapse: collapse;">
        <td  style="border: 1px solid black; border-collapse: collapse;">${name}</td>
        <td  style="border: 1px solid black; border-collapse: collapse;">${value}</td>
    </tr>`;

const ourReservation = (params) => {
    const {email, name, numPeople, date, note} = params;
    return {
        from: RESTAURANT_EMAIL,
        to: RESTAURANT_EMAIL,
        subject: `Reservierung für ${name} mit ${numPeople} Personen am ${date} bestätigen`,
        html: `<table style="border: 1px solid black; border-collapse: collapse;">
                ${tr('Datum und Uhrzeit', date)}
                ${tr('Name', name)}
                ${tr('Email', `<a href="mailto:${email}">${email}</a>`)}
                ${tr('Anzahl Personen', numPeople)}
                ${tr('Notizen', note)}
               </table><br><br>
               <a href="${HOST}/api/confirm?note=${note ?? 'keine'}&email=${email}&numPeople=${numPeople}&date=${date}&name=${name}&key=${CONFIRM_KEY}" target="_blank">Bestätigen</a>
                /   <a href="${HOST}/api/decline?email=${email}&numPeople=${numPeople}&date=${date}&name=${name}&key=${CONFIRM_KEY}" target="_blank">Ablehnen</a>`
    };
}

const decline = (params) => {
    const {email, name, numPeople, date} = params;
    return {
        from: RESTAURANT_EMAIL,
        to: email,
        cc: [RESTAURANT_EMAIL],
        subject: `Reservierung nicht möglich: ${name} mit ${numPeople} Personen am ${date}`,
        text: `Leider können wir die Reservierung auf den Namen '${name}' am ${date} nicht bestätigen.
             \nWir freuen uns auf Ihren nächsten Besuch!.`
    }
}
const sendMail = async (params, template) => {
    try {
        await mail.send(template(params))
    } catch (e) {
        log(e);
    }
}

const addToContacts = async (email) => {
    try {
        await contacts.request({
            url: '/v3/marketing/contacts',
            method: 'PUT',
            body: {'contacts': [{email}]},
        });
    } catch (e) {
        log(e);
    }
}

// Routes
app.post('/api/book', upload.array(), checkFormFields(MAIL_PARAMS), async (req, res) => {
    await sendMail(req.body, clientReservation);
    await sendMail(req.body, ourReservation);
    await addToContacts(req.body.email);
    res.status(200).end();
})

app.get('/api/places', (req, res) => {
    res.status(200).send(placesData);
});

app.get('/api/confirm', checkKey, checkParams(MAIL_PARAMS), async (req, res) => {
    await sendMail(req.query, confirmation);
    const {name, numPeople, date, note, email} = req.query;
    res.status(200).end(`Bestätigt: ${email} / ${name} mit ${numPeople} Personen am ${date}. Notiz: ${note ?? 'keine'}`);
});

app.get('/api/decline', checkKey, checkParams(MAIL_PARAMS), async (req, res) => {
    await sendMail(req.query, decline);
    const {name, numPeople, date, note, email} = req.query;
    res.status(200).end(`Abgelehnt: ${email} / ${name} mit ${numPeople} Personen am ${date}. Notiz: ${note ?? 'keine'}`);
});

// Start server
(async () => {
        placesData = await getGooglePlaceData();
        log('Got data from Google Places API');
        setInterval(async () => {
            placesData = await getGooglePlaceData();
            log('Updated data from Google Places API');
        }, THIRTY_MINUTES);
        app.listen(PORT, () => {
            log(`Server listening on port ${PORT}`);
        });
    }
)();