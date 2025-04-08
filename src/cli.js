import * as dotenv from 'dotenv'; 
dotenv.config();

import { get_production_data } from "./solar-api.js";

(async () => {
	let { feedin, purchased } = await get_production_data();
	console.log(`Solar panel production: ${feedin}kw - Externally purchased: ${purchased}kw`);
})();