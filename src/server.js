import * as dotenv from 'dotenv'; 
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';

import { get_production_data, calculate_kw } from "./solar-api.js";
import { get_charging, set_charging } from "./charger-api.js";
import { write_offset, read_offset } from "./db.js";

// Interval between requests to api
const INTERVAL = 15 * 1000 * 60;

// Storing data
let metrics_data = {
    solar_power_feedin: 0,
    solar_power_purchased: 0,
    read_kw: 0,
    set_kw: 0,
    offset: 0
}

const app = express();
app.use(bodyParser.json());

app.post('/offset', (req, res) =>  {
    write_offset(req.body.value);

    res.json({ "result": "Successfully changed offset to: " + req.body.value });
})

app.get('/prometheus', (req, res) => {
    res.setHeader('content-type', 'text/plain');
    /*
    # TYPE smc_health gauge
    smc_healt 1

    # TYPE smc_solar_power_feedin gauge
    smc_solar_power_feedin 9.123

    # TYPE smc_solar_power_purchased gauge
    smc_solar_power_purchased 9.123

    # TYPE smc_read_kw gauge
    smc_read_kw 9.123

    # TYPE smc_set_kw gauge
    smc_set_kw 9.123

    # TYPE smc_offset gauge
    smc_offset 9.123
    */

    res.send(`# TYPE smc_health gauge\nsmc_health 1\n# TYPE smc_solar_power_feedin gauge\nsmc_solar_power_feedin ${metrics_data.solar_power_feedin}\n# TYPE smc_solar_power_purchased gauge\nsmc_solar_power_purchased ${metrics_data.solar_power_purchased}\n# TYPE smc_read_kw gauge\nsmc_read_kw ${metrics_data.read_kw}\n# TYPE smc_set_kw gauge\nsmc_set_kw ${metrics_data.set_kw}\n# TYPE smc_offset gauge\nsmc_offset ${metrics_data.offset}`)
});

app.listen(process.env.PORT, () => { 
    console.log(`Server listening on port: ${process.env.PORT}`);

    setInterval(async function() {;
        try {
            console.log("GETTING DATA: ");

            // Get production data from solar panels
            let { feedin, purchased } = await get_production_data();
            metrics_data.solar_power_feedin = feedin;
            metrics_data.solar_power_purchased = purchased;

            // Get data from charger
            const current_kw = await get_charging();
            const offset = read_offset();

            // Calculate charging speed
            const kw = calculate_kw(current_kw, feedin, purchased, offset);
            metrics_data.read_kw = kw;
            metrics_data.offset = offset;
            metrics_data.set_kw = kw;

            // Set charging speed
            await set_charging(kw);
        } catch (err) {
            console.log("ERR: ", err);
        }
    }, INTERVAL);
});