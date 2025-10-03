import numpy as np
##

# 200w=[57.189,35.994,14.169,7.656,-7.656,-14.169,-35.994,-57.189]
# 125w=[16.875, 5.625, -5.625, -16.875]

##
import math


def build_extrugrip(Length,pitch,width):
    if width == 125:
        center_offsets=[16.875, 5.625, -5.625, -16.875]
    else:
        center_offsets=[57.189,35.994,14.169,7.656,-7.656,-14.169,-35.994,-57.189]
    trous_ligne=[]
    edge_offset=16
    hole_num=0
    for k in center_offsets:
        hole_num+= (math.floor((((Length/2) - edge_offset - k )/ pitch))*2)
        trous_ligne.append(math.floor((((Length/2) - edge_offset - k )/ pitch)))

#     --------------------------
    trous_ligne_inv=trous_ligne[::-1]
    List_coord=[]
    for k in center_offsets :
        i=center_offsets.index(k)
        Liste_temp=[]
        for j in range(trous_ligne[i]+1):
            Liste_temp.append(round(200-(k+j*35),3))
        for j in range(1,trous_ligne_inv[i]+1):
            Liste_temp.append(round(200-(k-j*35),3))
        Liste_temp.sort()
        List_coord.append(Liste_temp)

    return(hole_num+8,List_coord)

# retourne nb tot de trous et trous par ligne (moitie mirroir)

##


# def build_extru(Length,Width,pitch)
# for k in offset_zero :
#     i=offset_zero.index(k)
#     Liste_temp=[]
#     for j in range(L[i]+1):
#         Liste_temp.append(round(200-(k+j*35),3))
#     # List_coord.append(Liste_temp)
#     for j in range(1,Lb[i]+1):
#         Liste_temp.append(round(200-(k-j*35),3))
#     Liste_temp.sort()
#     List_coord.append(Liste_temp)
# print(List_coord,len(List_coord))


##
def bcs_or_wcs(w_product,List_coord,l_extru,bin):
    if bin==1:
        wcs=0
    else:
        wcs=math.inf
    if w_product==l_extru:
        w_product-=0.1

    a=(w_product-18)/2
    for k in np.arange(w_product/2,l_extru-w_product/2, 1):
        compt=0
        for c in range(maxi(List_coord)):
            for i in List_coord:
                try:
                    if k-a<i[c]<k+a:
                        compt+=1
                except:
                    pass
        if 0 < compt < wcs and bin==0:
            wcs = compt
        elif compt > wcs and bin ==1:
             wcs = compt
    return(wcs)

def maxi(L):
    c=0
    for k in L:
        if len(k)>c:
            c=len(k)
    return(c)

# print(maxi(Lb))




##
# def extrugrip2(L):
#     L3,L4=[],[]
#     edge_offset=16
#     pitch=35
#     hole_num=0
#     center_offsets=[57.189,35.994,14.169,7.656,-7.656,-14.169,-35.994,-57.189]
#     for k in center_offsets:
#         current = math.floor((((L/2) - edge_offset - k )/ pitch))
#         hole_num+= current*2
#         print((((L/2) - edge_offset - k )/ pitch))
#         print(hole_num,'hole_num')
#         L3.append(current)
#     for k, i in zip(L3, L3[::-1]):
#         L4.append(k+i+1)
#     return(L3,L3[::-1],L4)
# # L4 = nb de trous par ligne



