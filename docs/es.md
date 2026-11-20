# ČHMÚ Czech weather

El tiempo oficial de **Chequia** en Gladys, del **ČHMÚ** (Český hydrometeorologický ústav, el
Instituto Hidrometeorológico Checo): los datos de la **estación meteorológica** más cercana y las
**alertas meteorológicas oficiales** de su **distrito ORP** (viento, nieve y hielo, tormentas,
calor, frío, riesgo de incendio, lluvia, inundación…).

Datos abiertos: sin cuenta ni clave de API. Esta integración no tiene relación con el ČHMÚ.

## Presentación

- **Dos dispositivos**: la estación más cercana (temperatura, humedad, presión, viento, ráfagas,
  lluvia, insolación) y las alertas de su distrito (nivel actual, nivel más alto anunciado, lista
  de alertas).
- **Un disparador de escena**, «Nueva alerta del ČHMÚ», en cuanto se anuncia una alerta, a menudo
  horas antes de su inicio.
- **Un widget de panel** con los datos de la estación y las alertas del distrito.
- **Solo lectura**: el ČHMÚ es una fuente de datos, no se controla nada.

El ČHMÚ emite sus alertas para cada uno de los **206 distritos ORP** de Chequia (obce s rozšířenou
působností). La integración MeteoAlarm también muestra las alertas checas, mediante el flujo
europeo; esta lee directamente los archivos del ČHMÚ y añade los datos de las estaciones checas.

## Requisitos

- Gladys **5.3.0** o posterior.
- Un lugar en **Chequia**.
- Su casa de Gladys situada en el mapa (**Ajustes → Casas**), o coordenadas, una estación o un
  distrito indicados en la configuración.
- Gladys debe acceder a Internet (`opendata.chmi.cz`).

## Configuración

Instale la integración desde **Integraciones → Instalar desde GitHub** (o desde la tienda), y
abra su configuración. Todos los campos son opcionales: por defecto, la integración toma la
posición de su primera casa situada, la estación más cercana, el distrito donde se encuentra, y se
actualiza cada 15 minutos.

| Campo                              | Uso                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Casa                               | La casa cuya posición se usa. Vacío: la primera casa con posición.                                                                    |
| Latitud, Longitud                  | Otro lugar que una casa, por ejemplo `50,08` y `14,42` (el punto también vale). Las dos, o ninguna.                                   |
| Estación meteorológica             | Una estación del ČHMÚ, por ejemplo `0-20000-0-11518` o `P1PRUZ01` (Praha, Ruzyně). Vacío: la más cercana.                             |
| Distrito de alertas                | El nombre (`Beroun`, con o sin tildes) o el código de 4 cifras (`2102`) de un distrito ORP. Vacío: el del lugar.                      |
| Intervalo de actualización         | 15, 30 o 60 minutos. El ČHMÚ publica los datos de las estaciones una vez por hora.                                                    |
| Idioma de los nombres de funciones | Idioma de los nombres de funciones (fijados al crear los dispositivos) y de los textos de los eventos de escena. Francés por defecto. |

La posición de la casa se lee mediante el permiso `location` de Gladys, mostrado en la instalación.
Nunca sale de Gladys: el distrito se determina en el contenedor, a partir de los contornos de los
distritos que incluye, y solo se descargan los archivos de la estación y de las alertas.

Abra después la pestaña **Descubrimiento** de la integración y añada los dos dispositivos a Gladys.

## Dispositivos

### Estación

El nombre es «ČHMÚ» seguido del nombre de la estación. Valores de la última observación de 10
minutos:

| Función                     | Unidad | Nota                                                      |
| --------------------------- | ------ | --------------------------------------------------------- |
| Temperatura                 | °C     | Temperatura del aire, a 2 m                               |
| Humedad                     | %      |                                                           |
| Presión (en la estación)    | hPa    | A la altitud de la estación, no reducida al nivel del mar |
| Velocidad del viento        | km/h   | Media de 10 minutos                                       |
| Ráfagas                     | km/h   | Ráfaga más fuerte de los últimos 10 minutos               |
| Dirección del viento        | °      | De dónde viene el viento: 0 = norte, 90 = este            |
| Intensidad de lluvia        | mm/h   | Lluvia de los últimos 10 minutos, por hora                |
| Insolación (últimos 10 min) | min    | 0 a 10                                                    |

El dispositivo solo tiene las funciones que mide la estación (muchas no tienen barómetro). El ČHMÚ
publica los valores de 10 minutos **una vez por hora**: los datos tienen hasta unos 70 minutos. Una
estación sin datos desde hace más de 3 horas deja de publicarse como actual.

### Distrito

El nombre es «Alertas ČHMÚ» seguido del nombre del distrito, para distinguirlo de la estación de la misma ciudad.

| Función                            | Unidad | Nota                                                                     |
| ---------------------------------- | ------ | ------------------------------------------------------------------------ |
| Nivel de alerta actual             | 0 a 3  | Nivel más alto en vigor: 0 ninguno, 1 amarillo, 2 naranja, 3 rojo        |
| Nivel de alerta más alto anunciado | 0 a 3  | Nivel más alto de las alertas en vigor o anunciadas                      |
| Alertas meteorológicas             | texto  | Las alertas en vigor o anunciadas, p. ej. «Naranja · Viento → mar 18:00» |

## Widget

**Tiempo ČHMÚ** muestra, en el idioma y las unidades del panel:

- el nombre de la casa (o del distrito), luego la temperatura, la humedad, el viento y las ráfagas
  de la estación;
- las alertas en vigor (hasta cuándo) y anunciadas (desde cuándo), o una línea verde «Ninguna»;
- la fuente y la hora de la observación.

Dos ajustes del widget ocultan los datos de la estación o las alertas.

## Disparador de escena

**Nueva alerta del ČHMÚ** se activa cuando el ČHMÚ emite una alerta para el distrito, o sube su
nivel, en cuanto se anuncia. El ČHMÚ vuelve a emitir sus alertas varias veces al día: una alerta
solo prolongada o reemitida no vuelve a activarlo. Un reinicio tampoco, y el primerísimo arranque
solo toma nota de las alertas ya emitidas.

Filtros (vacío = todos): **Tipos de alerta** (viento, nieve y hielo, tormentas, niebla, calor,
frío, riesgo de incendio, lluvia, inundación, otro fenómeno) y **Niveles** (amarilla, naranja,
roja).

Información transmitida a las acciones de la escena: tipo de alerta, nivel, nivel (1 a 3), nombre
oficial (en inglés y en checo), inicio, fin, ya en vigor, nivel subido, texto oficial y consejos
(en inglés) y distrito. Por ejemplo, un mensaje: `ČHMÚ: alerta {{triggerEvent.data.type_label}}
{{triggerEvent.data.level_label}} de {{triggerEvent.data.starts_at}} a
{{triggerEvent.data.ends_at}}`.

## Acciones de configuración

- **Listar las estaciones cercanas**: las 8 estaciones más cercanas al lugar, con sus
  identificadores, altitud y distancia, y el distrito de alerta del lugar. Copie un identificador
  en «Estación meteorológica» para elegir otra.
- **Comprobar la conexión**: lee todas las fuentes de inmediato y dice qué ha respondido: la
  temperatura de la estación y su hora, el número de alertas. Se muestra en rojo si falla una
  fuente.

## Ejemplos de escenas

- **Llega un temporal**: disparador «Nueva alerta del ČHMÚ», tipos «Viento» y «Tormentas», niveles
  «Naranja» y «Roja» → cerrar las persianas, recoger el toldo, enviar un mensaje con la hora de
  inicio.
- **Día de calor**: cuando «Nivel de alerta actual» sea mayor o igual que 2 → cerrar las persianas
  del lado sur y enviar un recordatorio para beber.
- **Helada**: cuando la «Temperatura» de la estación baje de 0 °C → avisar para proteger las
  plantas.

## Solución de problemas

- **«Ningún lugar»**: ninguna casa tiene posición. Sitúe su casa en el mapa en **Ajustes → Casas**,
  o escriba coordenadas, una estación o un distrito.
- **«Fuera de Chequia»**: el lugar no está en ningún distrito checo. Escriba un distrito que desee
  seguir de todos modos.
- **«El ČHMÚ no responde»**: Gladys no alcanza `opendata.chmi.cz`; los valores se actualizarán
  cuando vuelva. Los registros indican qué fuente falla, una vez, y cuándo vuelve a funcionar.
- **Falta una función**: la estación no la mide. Elija otra estación con **Listar las estaciones
  cercanas**.
- **Más detalles**: ponga la variable `LOG_LEVEL` del contenedor en `debug`.

## Límites

- **Datos**: datos abiertos del ČHMÚ, licencia
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) («Fuente: ČHMÚ», mostrado por el
  widget). Contornos de los distritos: ČÚZK (RÚIAN) y ČSÚ, CC BY 4.0, simplificados a unos 500 m:
  cerca de un límite de distrito, escriba el distrito.
- **Peticiones**: en cada actualización, el índice CAP (unos 100 KB) y el archivo de la estación,
  que solo vuelve cuando el ČHMÚ lo reescribe (una vez por hora, unos 150 KB); el archivo CAP (1,5 a
  2 MB) solo cuando se emite uno nuevo, varias veces al día; la lista de estaciones una vez al día.
  El ČHMÚ no publica ningún límite.
- Las observaciones llegan en lotes horarios de valores de 10 minutos, no en directo.
- Un lugar, una estación y un distrito por instalación. Sin previsión: el ČHMÚ no publica ninguna
  como datos abiertos para un punto.
- Los nombres de las funciones se fijan al crear los dispositivos: cambiar el idioma después no los
  renombra.
