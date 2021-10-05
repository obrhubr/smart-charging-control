import * as dotenv from 'dotenv'; 
dotenv.config();
import fetch from 'node-fetch';

async function request_data() {
    // StartTime and EndTime are spaced apart 15min
    var startTime = new Date();
    startTime = startTime.getFullYear() + '-' + startTime.getMonth() + '-' + startTime.getDay() + '%20' + startTime.getHours() + ':'  + startTime.getMinutes() + ':' + startTime.getSeconds();
    var endTime = new Date(new Date().getTime() + (60 * 1000));
    endTime = endTime.getFullYear() + '-' + endTime.getMonth() + '-' + endTime.getDay() + '%20' + endTime.getHours() + ':'  + endTime.getMinutes() + ':' + endTime.getSeconds();

    // Get data from api
    const response = await fetch(
        'https://monitoringapi.solaredge.com/site/' +
        process.env.SITEID +
        '/powerDetails?meters=PRODUCTION&startTime=' +
        startTime + 
        '&endTime=' +
        endTime +
        '&api_key=' + 
        process.env.TOKEN

        , {method: 'GET'}
    );
    const data = await response.json();

    var production = data.powerDetails.meters[0].values[0].value;
    console.log("PRODUCTION: ", production);

    return production;
}

function get_kw(production) {
    return Math.floor((production - 2000) / 1000);
}

async function set_charging(kw) {
    const response = await fetch(
        'http://10.0.0.8:5000/charging-speed/set',
        {
            method: 'POST', 
            body: JSON.stringify({
                "value": kw ?? 0
            }),
            headers: {'Content-Type': 'application/json'}
        }
    );
    const data = await response.json();
    console.log("RESPONSE: ", data);
}

setInterval(async function() {;
    var kw = await get_kw(await request_data());

    set_charging(kw);
}, 15 * 60 * 1000);