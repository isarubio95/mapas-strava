# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Deportistas en general que usan Strava: corredores, ciclistas, senderistas y
cualquiera que registre salidas con GPS. Producto abierto al público. Entran
con su cuenta, conectan Strava y quieren ver todas sus rutas a la vez, en el
ordenador o en el móvil.

## Product Purpose

Trazo dibuja todas las rutas de Strava de una persona a la vez sobre un mapa,
con filtros, resumen, reproducción en el tiempo, mapa de calor, vista 3D sobre
el relieve real y pósteres. Existe para que el historial deportivo de alguien
se vea entero y bonito, no como una lista de actividades sueltas.

## Positioning

Lo que distingue a Trazo de otras herramientas de rutas (el mapa de calor de
Strava, Statshunters, Wandrer…):

- **La belleza del mapa.** Las rutas se convierten en una imagen que luce como
  una obra, y los pósteres se pueden imprimir o compartir.
- **Relieve y 3D.** Ver y revivir las rutas sobre el terreno real, incluido el
  recorrido en 3D en el que la cámara sigue una ruta.

## Operating Context

- Se entra con cuenta propia (correo y contraseña) y se conecta Strava por
  OAuth desde `/conectar`. Sin Strava conectado, la app lleva allí.
- El mapa abre en la zona donde empiezan la mayoría de las rutas.
- Se usa en escritorio y en móvil; el móvil tiene su propia distribución, con
  los filtros en un cajón inferior.
- Los pósteres se diseñan en `/poster` y se exportan para imprimir o compartir.

## Capabilities and Constraints

- Modos del mapa: Rutas, Calor, Tiempo (reproducción cronológica) y 3D
  (`?vista=3d`), con recorrido 3D de una ruta.
- Filtros por deporte, fechas, distancia, lugar (país, región, ciudad) y
  cercanía a un punto; buscador de rutas por título; ruta sola; perfil de
  altitud de cada actividad.
- Ajustes: color por deporte, exportar datos y desconectar o eliminar.
- Tema de día y de noche. Se respeta `prefers-reduced-motion`.
- Backend en Supabase con RLS; los secretos de Strava viven solo en las Edge
  Functions.
- Mapas de OpenFreeMap con datos de OpenStreetMap; elevación de Mapterhorn. Sus
  atribuciones son obligatorias.
- Idioma: español ahora. El producto debe poder traducirse más adelante (inglés
  y otros), así que los textos no deben quedar atados al español de forma que
  lo impida.
- "Trazo" es un nombre de trabajo.

## Brand Commitments

- Las guías de marca de Strava no permiten "Strava" en el nombre de la app. Los
  textos "Connect with Strava" y "View on Strava" siguen esas guías.
- Promesas de privacidad que ya figuran en `/conectar` y `/privacidad`: solo la
  persona ve sus rutas; la copia es una caché de como máximo 7 días; los datos
  no se envían a modelos de IA ni a analítica de terceros; se pueden exportar y
  eliminar desde Ajustes, y al eliminarlos se revoca el acceso en Strava.

## Evidence on Hand

- Datos sintéticos: 800 actividades en `/prototipos`, generadas por
  `tests/fixtures/synthetic.ts`, y una API de Strava simulada en
  `tests/strava-mock/`.
- Referencias visuales en `docs/referencias/` (`design.png`, `poster.png`,
  `icons.png`, `toggle-dia.jpg`, `toggle-noche.jpg`) y el icono en
  `docs/icono-trazo.png`.
- No hay usuarios reales, testimonios, métricas, prensa ni precios. No deben
  inventarse.

## Product Principles

- **El mapa es la obra.** Las rutas de la persona son el protagonista; la
  interfaz acompaña y se aparta cuando hace falta.
- **Revivir, no solo listar.** El relieve, el 3D y el tiempo existen para que
  las salidas se sientan, no solo para contarlas.
- **Tus datos son tuyos.** Las promesas de privacidad son parte del producto y
  no se rebajan en silencio.
- **Listo para otros idiomas.** Lo que se construya hoy en español debe poder
  traducirse mañana.
