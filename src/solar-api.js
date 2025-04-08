import moment from 'moment-timezone';
import fetch from 'node-fetch';

function calculate_kw(last_charging_kw_not_corrected, feedin, purchased, offset) {
	var last_charging_kw = last_charging_kw_not_corrected < 4.3 ? 2 : last_charging_kw_not_corrected;-

	console.log("GET KW FORMULA: (last_charging_kw, feedin, purchased) ", last_charging_kw, feedin, purchased);

	var charging_kw = Math.min(Math.max(((last_charging_kw + feedin / 1000 - purchased / 1000) + offset), 4.2), 8);
	var rounded = Math.round(charging_kw);

	console.log("SETTING TO: (rounded, not rounded) ", rounded, charging_kw);

	return rounded;
}

function get_timezone_date() {
	const viennaTime = moment().tz("Europe/Vienna");
	return viennaTime;
}

function api_time() {
	// Get timezone corrected time
	var tz_time = get_timezone_date();
	console.log("CURRENT TIME:", tz_time);

	// Get the date 15 minutes ago
	var date = new Date(tz_time.subtract(15, 'minutes'));
	const dateString = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '%20' + date.getHours() + ':'  + date.getMinutes() + ':' + date.getSeconds();

	return dateString;
}

async function get_solar_data() {
	const dateString = api_time();
	const url = `https://monitoringapi.solaredge.com/site/${process.env.SITEID}/powerDetails.json?meters=FEEDIN,PURCHASED&startTime=${dateString}&endTime=${dateString}&api_key=${process.env.TOKEN}`;
	
	// Get data from api
	const response = await fetch(
		url
		, {method: 'GET'}
	);
	return await response.json();
}

async function get_production_data() {
	const data = await get_solar_data();
	console.log(data);

	var purchased = 0;
	var feedin = 0;
	
	for(var i = 0; i < 2; i++) {
		if(data.powerDetails.meters[i].type == "Purchased") {
			purchased = data.powerDetails.meters[i].values[0].value;
		}
		if(data.powerDetails.meters[i].type == "FeedIn") {
			feedin = data.powerDetails.meters[i].values[0].value;
		}
	}
	
	return { feedin, purchased };
}

export {
	get_production_data,
	calculate_kw
}