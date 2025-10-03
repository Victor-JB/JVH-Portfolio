class MyClass:
    def __init__(self, parameter1, parameter2):
        self.attribute1 = parameter1
        self.attribute2 = parameter2

##
import itertools

class Input:
    def __init__(self,Width,Length,nb_boxes,pick,release):
        self.W=Width
        self.L=Length
        self.nb=nb_boxes
        self.pick=pick
        self.release=release

    def pickL(self):
        pickL=[0]
        c=0
        for k in self.pick:
            c=c+k*self.W
            pickL.append(c)
        return(pickL)

    def releaseL(self):
        releaseL=[0]
        c=0
        for k in self.release:
            c=c+k*self.W
            releaseL.append(c)
        return(releaseL)

    def Row(self):
        Row=list(set(self.pickL()+self.releaseL()))
        Row.sort()
        # print(Row,'Row')
        return(Row)


def merge_rows(List_Inputs,List_bool):
    mergedRow=[]
    maxi=max([max(k.Row()) for k in List_Inputs])
    # print(maxi,'maxi')
    for i in range(len(List_Inputs)):
        L_temp=List_Inputs[i].Row()
        # print(L_temp,'L_temp')
        if bool(List_bool[i]):
            #Creer fonction adjust
            # for k in range(len(L_temp)):
            #     L_temp[k]=L_temp[k]+((maxi-L_temp[-1])/2)
            L_temp=center_row2(L_temp,maxi)
        for k in L_temp:
            if k not in mergedRow:
                mergedRow.append(k)
    mergedRow.sort()
    return(mergedRow)

def center_row2(Row,maxi):
    print(Row,'a',maxi)
    for k in range(len(Row)):
        Row[k]=Row[k]+((maxi-Row[-1])/2)
    print(Row,'b')
    return(Row)


def Output(Merged_rows): #prend une liste avec les coord de ttes les row
    Mr=Merged_rows
    # print(Mr,'Mr')
    # c=float(entry.get()) #c = min zone
    c=5
    zone_bgn=[Mr.pop(0)]
    zone_end=[Mr.pop(len(Mr)-1)]

    # print(Mr, 'after end an bgn')
    zone=[]
    avgL=[Mr[0]]
    avg=Average(avgL)
    comp=Mr[0]
    # print('top depart')
    for k in range(len(Mr)-1):
        # print(Mr,Mr[k],Mr[k+1],'k et k+1')
        if Mr[k+1]<=comp+c:
            avgL.append(Mr[k+1])
            avg=Average(avgL)
            # print('inside loop',Mr[k+1],'Mr[k+1]',avg,'avg',avgL,'avgL')
        else:
            zone.append(avg)
            avgL=[Mr[k+1]]
            comp=Mr[k+1]
            avg=Average(avgL)

    zone.append(avg)
    zone=zone_bgn+zone+zone_end
    # print(zone,'zone')
    return(zone)

def Average(lst):
    return sum(lst) / len(lst)

def optimisation(List_Inputs,n):
    Lbool=list(itertools.product([0,1], repeat=n))
    opti=[]
    multi_opti=[]
    c=0
    for i in Lbool:
        if len(Output(merge_rows(List_Inputs,i))) > c :
            c=len(Output(merge_rows(List_Inputs,i)))
            opti=[c,i]
            multi_opti=[]
        if len(Output(merge_rows(List_Inputs,i))) == c :
            multi_opti.append([c,i])

    if multi_opti != [] :
        return(multi_opti)
    else:
        return(opti)



L=[Input(3,5,4,[4],[1,1,1,1]),Input(2,4,5,[4,1],[1,1,1,1,1])]
print(L[0].pickL(),'qqq')
Lb=[1,0]
print(Output(merge_rows(L,[1,0])),'oh')
print(merge_rows(L,[1,1]),'waza')
# print(Output(merge_rows(L,[0,1])))
# print(Output(merge_rows(L,[0,0])))
# print(Output([0.0, 2, 3.0, 4, 6.0, 8, 9.0, 10, 12.0]),'output')
print(optimisation(L,2),'opti')


##
[0.0, 2, 3.0, 4, 6.0, 8, 9.0, 10, 12.0]
[0.0, 1.0, 3.0, 5.0, 6.0, 7.0, 9.0, 11.0, 12.0]
[0, 1.0, 3, 5.0, 6, 7.0, 9, 11.0, 12]
[0, 2, 3, 4, 6, 8, 9, 10, 12]

####
def center_row(L):
    l=len(L)
    e=L[l-1]
    for k in range(len(L)):
        L[k]=L[k]-(e/2)
    return(L)




def Output(Merged_rows): #prend une liste avec les coord de ttes les row
    Mr=Merged_rows
    print(Mr)
    c=float(entry.get()) #c = min zone
    zone_bgn=[Mr.pop(0)]
    zone_end=[Mr.pop(len(L)-1)]

    zone=[]
    avgL=[L[0]]
    avg=Average(avgL)
    # deadZ=[]
    # deadZ_temp=[]
    # print(zone,avgL,avg,'begin calculate zone')
    comp=L[0]
    for k in range(len(L)-1):
        # print(k,'k',L[k])
        # print(L[k+1])
        if comp-c<=L[k+1]<=comp+c:
            avgL.append(L[k+1])
            # deadZ_temp.append(L[k])
            # deadZ_temp.append(L[k+1])
            avg=Average(avgL)
            print('inside loop 2',L[k+1],avg,avgL)
        else:
            zone.append(avg)
            avgL=[L[k+1]]
            comp=L[k+1]
            avg=Average(avgL)
            # deadZ.append(list(set(deadZ_temp)))
            # deadZ_temp=[]
    zone.append(avg)
    zone=zone_bgn+zone+zone_end
    # print(zone,'zone',deadZ)
    # for i in range(len(deadZ)-1):
    #     deadZ[i]=[deadZ[i][0],deadZ[i][-1]]
    # print(deadZ,'finit0')
    print(zone,'zone')
    return(zone)

# class Brut:
#         def __init__(self,ListOfInputs):
#             self.ListI=ListOfInputs






# L=[h,w,nb,[1,1,1],[1,0,2]]

##
