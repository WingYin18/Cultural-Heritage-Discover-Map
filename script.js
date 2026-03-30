const map = L.map('map-container').setView([22.3193, 114.1694], 11);


L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '2026'
}).addTo(map);



let userLatLng = null;
let routingControl = null;
let sites = [];
let currentSite = null;
let myLocationMarker = null; // maker object
let isRouteEnabled = true;


const apiUrl = "https://portal.csdi.gov.hk/server/services/common/devb_wb_rcd_1639040299687_46105/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=DM_20260130_150858&outputFormat=geojson&count=10000"

async function fetchHeritageData() {
    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            statusText.innerText = "API response failed... Status: ${response.status}`"
        }

        const data = await response.json();
        console.log("Recieve Data Successfully : ", data.features[0].properties.NAME_TC);

        return data;
    } catch (error) {
        console.error("API response failed... Status: ", error);
        return null;
    }
}

function processHeritageData(data) {
    if (!data || !data.features) return [];

    return data.features.map(feature => { //return for function
        const firstCoord = feature.geometry.coordinates[0][0][0];
        return {nameEN: feature.properties.NAME, //return for map
        nameTC: feature.properties.NAME_TC,
        lng: firstCoord[0],
        lat: firstCoord[1],
        addressEN: feature.properties.ADDRESS,
        addressTC: feature.properties.ADDRESS_TC,
        URL_IMAGE: feature.properties.URL_IMAGE
        }
    })
}

async function initHeritageMap() {
    const data = await fetchHeritageData();

    if (data) {
        sites = processHeritageData(data);
        console.log("處理完成的古蹟總數：", sites.length);
        markerDisplay(sites);
    }

}

const statusText = document.getElementById('status-text');
function locationCheck() {
    statusText.innerText = "🔍 Searching for Your Location...";
    if (!navigator.geolocation) {
        statusText.innerText = "❌ Your Browser Does Not Support GPS Positioning..."
        return;
    }
    navigator.geolocation.getCurrentPosition(successGPS,errorGPS);
}

function successGPS(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    userLatLng = L.latLng(userLat,userLng)
    statusText.innerText = `✅ GPS Positioning Successfully! (Lat:${userLat.toFixed(2)}, Long:${userLng.toFixed(2)})`;

    if (myLocationMarker) {
        map.removeLayer(myLocationMarker);
    }
    map.flyTo([userLat, userLng], 16);                    //畫用戶定位藍圈
    myLocationMarker = L.circle([userLat, userLng], {
        color: 'blue',
        fillColor: '#30f',
        fillOpacity: 0.2,
        radius: 100 // 半徑 100 公尺
    }).addTo(map)
}

function errorGPS(position) {
    statusText.innerText = "❌ GPS Positioning Failed, Please Check the GPS Permission...";
}

function markerDisplay(data) {
    if (!data) {
        console.error("MarkerDisplay 接收到的 data 是空的！");
        return;
    }
    console.log("正在渲染標記，數量：", data.length);

    for (let i = 0; i < data.length; i++) {
        coords = [data[i].lat, data[i].lng] 
        L.marker(coords).addTo(map);
    }
};

function drawRoute(targetLat, targetLng) {
    if (!userLatLng) {
        alert("Please press Current Position button again")
        return;
    }

    if (routingControl) {
        map.removeControl(routingControl); //移除舊路線
    }

    const directionsDiv = document.getElementById('directions');
     directionsDiv.innerHTML = '<h1>📍 Recommended Route</h1> <p style="color: #999;">Waiting for route planning...</p>'; // 清空之前的內容

    routingControl = L.Routing.control({
    waypoints: [
        userLatLng, // 起點：用戶位置
        L.latLng(targetLat, targetLng)  // 終點：CH位置
    ],lineOptions: {
        styles: [{ color: '#2563eb', weight: 10 }]
        },
        // 1. 關閉原本在地圖上的預設面板
        show:true,
        itinerary: {
            containerClassName: 'my-custom-directions'
        }
    }).addTo(map);

    
    directionsDiv.innerHTML = '<h1>📍 Recommended Route  </h1>'; // 清空之前的內容

    const routingContainer = routingControl.getContainer(); // 取得整個插件容器
    directionsDiv.appendChild(routingContainer);
}

const random_btn = document.getElementById("random-btn");

random_btn.addEventListener('click', function() {
    if (sites.length === 0) {
        alert("數據還在加載中，請稍候...");
        return;
    }

    const randomIndex = Math.floor(Math.random() * sites.length);
    const pick = sites[randomIndex];

    currentSite = pick; //更新state management

    const targetCoords = [pick.lat, pick.lng];
    
    map.flyTo(targetCoords, 16); 

    const popupContent = `
        <div style="padding: 5px;">
            <b style="font-size: 1.1em;">${pick.nameEN} ${pick.nameTC}</b><br>
            <span style="color: #666;">${pick.addressEN} ${pick.addressTC} </span><br>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
            <a href="${pick.URL_IMAGE}" target="_blank" 
               style="display: inline-block; background-color: #007bff; color: white; 
                      padding: 8px 12px; text-decoration: none; border-radius: 4px; 
                      font-weight: bold; font-size: 12px; text-align: center;">
               查看官方相簿 Visit Official Gallery↗
            </a>
        </div>
    `;

    L.marker(targetCoords)
        .addTo(map)
        .bindPopup(popupContent)
        .openPopup();

    if (isRouteEnabled && userLatLng) {
        setTimeout(() => {drawRoute(pick.lat, pick.lng)}, 2000)
    } else {
        console.log("Routing is disabled or User location is missing.");
    }
});







const locate_btn = document.getElementById("locate-btn");

locate_btn.addEventListener('click',function() {
    if (myLocationMarker) {
        map.flyTo(myLocationMarker.getLatLng(), 16);
        map.removeControl(routingControl);
    } else {
        statusText.innerText = "正在重新嘗試定位...";
        locationCheck();
    }
})








let routeBtn = document.getElementById('route_toggle-btn');

routeBtn.addEventListener('click',function() {
    isRouteEnabled = !isRouteEnabled;

    if (isRouteEnabled) {
        this.innerText = "Show Route: ON";
        this.classList.remove('off-style')
        this.classList.add('on-style')
        
        // TODO: 這裡之後放「顯示路線」的函數
        console.log("navigation is on");
        drawRoute(currentSite.lat, currentSite.lng);
    } else {
        this.innerText = "Show Route: OFF";
        this.classList.remove('on-style');
        this.classList.add('off-style');
        
        // TODO: 這裡之後放「隱藏路線」的函數
        console.log("navigation is off");
        map.removeControl(routingControl);
    }
})


window.addEventListener('scroll', function() {
    const target = document.getElementById('parallax');
    
    // 取得目前捲動的距離
    let scrolled = window.pageYOffset;
    
    // 計算背景位移：捲動距離 * 速度因子 (0.2 代表只動 20%)
    // 數值越小，背景動得越慢，距離感越深
    let rate = scrolled * 0.2;
    
    // 動態修改背景的 Y 軸位置
    target.style.backgroundPosition = `center ${rate}px`;
});

window.onload = function () {
    initHeritageMap();
    locationCheck();
};

