export const sampleRoom = {
  id: "living-room-01",

  name: "Modern Living Room",

  description:
    "3D interior preview room",


  width: 10,

  depth: 8,


  walls: [
    {
      id: "back-wall",

      start: {
        x: -5,
        z: -4,
      },

      end: {
        x: 5,
        z: -4,
      },
    },

    {
      id: "left-wall",

      start: {
        x: -5,
        z: -4,
      },

      end: {
        x: -5,
        z: 4,
      },
    },
  ],


  door: {
    position: {
      x: 3.5,
      z: 4,
    },

    dimensions: {
      width: 1,
      height: 2,
    },
  },


  window: {
    position: {
      x: 1.5,
      z: -4,
    },

    dimensions: {
      width: 3,
      height: 2,
    },
  },
  furniture:[



    // TV 벽

    {

      id:"tv-wall",

      type:"wall-panel",

      position:[
        -4.75,
        1.7,
        -0.5
      ],

      size:[
        0.12,
        3.2,
        3.8
      ],

      color:"#ddd8d2"

    },



    // TV

    {

      id:"tv",

      type:"tv",

      position:[
        -4.55,
        1.9,
        -0.5
      ],

      size:[
        0.08,
        1.25,
        2.2
      ],

      color:"#111111"

    },



    // TV 하부장

    {

      id:"tv-stand",

      type:"cabinet",

      position:[
        -4.35,
        0.35,
        -0.5
      ],

      size:[
        0.55,
        0.45,
        2.8
      ],

      color:"#7b6248"

    },



    // 책장

    {

      id:"bookshelf",

      type:"bookshelf",

      position:[
        -3.9,
        1.8,
        -2.8
      ],

      size:[
        0.45,
        3.2,
        1.1
      ],

      color:"#8b6848"

    },



    // 왼쪽 소파

    {

      id:"sofa-left",

      type:"sofa",

      position:[
        1.0,
        0.55,
        -1.1
      ],


      rotation:[
        0,
        Math.PI / 2,
        0
      ],


      size:[
        2.6,
        1.1,
        1
      ],


      color:"#f5f1ea"

    },



    // 앞쪽 소파

    {

      id:"sofa-bottom",

      type:"sofa",

      position:[
        2,
        0.55,
        2
      ],


      size:[
        3.4,
        1.1,
        1
      ],


      color:"#f5f1ea"

    },



    // 러그

    {

      id:"rug",

      type:"rug",

      position:[
        1.2,
        0.02,
        0.8
      ],

      size:[
        4.5,
        0.02,
        3
      ],


      color:"#d8cdbd"

    },



    // 원형 테이블

    {

      id:"table",

      type:"round-table",

      position:[
        0.5,
        0.3,
        0.7
      ],


      radius:0.65,


      height:0.45,


      color:"#a37446"

    },



    // 스탠드

    {

      id:"lamp",

      type:"floor-lamp",

      position:[
        3.3,
        0,
        -2.5
      ],


      height:2.8,


      color:"#222222"

    },



    // 화분

    {

      id:"plant",

      type:"plant",

      position:[
        -1,
        0.4,
        2
      ],


      size:0.35,


      color:"#4d7c4a"

    }

  ]

};